import type { Socket } from 'socket.io-client';

export type CallParticipant = { socketId: string; userId: string; name: string; microphone: boolean; camera: boolean; sharing: boolean; handRaised: boolean };
export type Meeting = { id: string; conversationId: string; meetingId?: string; title: string; mode: 'audio' | 'video'; hostId: string; startedAt: string; participants: CallParticipant[] };
export type Invitation = Meeting & { callerName: string; expiresAt: number };
export type RemoteMedia = { audio: MediaStream; camera: MediaStream; screen: MediaStream; status: RTCPeerConnectionState };
type Signal = { description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
type Peer = { pc: RTCPeerConnection; ready: Promise<void>; candidates: RTCIceCandidateInit[]; media: RemoteMedia; queue: Promise<void> };

export async function callCommand<T = Record<string, never>>(socket: Socket, event: string, payload: object): Promise<T> {
  if (!socket.connected) throw new Error('Calling is offline. Check your connection and try again.');
  let result;
  try { result = await socket.timeout(12000).emitWithAck(event, payload); }
  catch { throw new Error('The call server did not respond. Please try again.'); }
  if (!result?.success) throw new Error(result?.message || 'Call request failed');
  return result as T;
}

// Three permanent media slots let a participant present and use their camera
// together. Replacing tracks does not trigger competing renegotiations.
export class MeetingMedia {
  peers = new Map<string, Peer>();
  display: MediaStream | null = null;
  private lastCameraStop = 0;
  closed = false;
  constructor(public socket: Socket, public meeting: Meeting, public local: MediaStream,
    private configuration: RTCConfiguration, private changed: () => void, private report: (message: string) => void,
    private sharingStopped: () => void) {}

  private payload() { return { conversationId: this.meeting.conversationId, callId: this.meeting.id }; }
  private send(to: string, signal: Signal) {
    if (!this.closed) void callCommand(this.socket, 'call:signal', { ...this.payload(), to, signal }).catch(error => { if (!this.closed) this.report(error.message); });
  }
  private peer(id: string): Peer {
    const existing = this.peers.get(id);
    if (existing) return existing;
    const pc = new RTCPeerConnection(this.configuration);
    // Only the offerer creates transceivers. The answerer adopts the three
    // offered slots; precreating them would add duplicate, unassociated slots.
    const offerer = this.socket.id! < id;
    if (offerer) {
      pc.addTransceiver('audio', { direction: 'sendrecv' });
      pc.addTransceiver('video', { direction: 'sendrecv' });
      pc.addTransceiver('video', { direction: 'sendrecv' });
    }
    const peer: Peer = { pc, candidates: [], media: { audio: new MediaStream(), camera: new MediaStream(), screen: new MediaStream(), status: 'new' }, queue: Promise.resolve(),
      ready: offerer ? this.bindTracks(pc) : Promise.resolve() };
    this.peers.set(id, peer);
    pc.onicecandidate = event => { if (event.candidate) this.send(id, { candidate: event.candidate.toJSON() }); };
    pc.ontrack = event => {
      // Audio cannot depend on the camera producing a video frame.
      const stream = event.track.kind === 'audio' ? peer.media.audio : pc.getTransceivers().indexOf(event.transceiver) === 2 ? peer.media.screen : peer.media.camera;
      stream.addTrack(event.track);
      event.track.onunmute = () => this.changed();
      this.changed();
    };
    let retries = 0;
    pc.onconnectionstatechange = () => {
      peer.media.status = pc.connectionState; this.changed();
      if (pc.connectionState === 'failed') {
        if (this.socket.id! < id && retries++ < 2) void this.offer(id, peer, true).catch(error => this.report(error.message));
        else this.report('A participant could not connect. Check your network or leave and rejoin.');
      }
    };
    return peer;
  }
  private async bindTracks(pc: RTCPeerConnection) {
    const slots = pc.getTransceivers();
    const tracks = [this.local.getAudioTracks()[0] || null, this.local.getVideoTracks()[0] || null, this.display?.getVideoTracks()[0] || null];
    await Promise.all(slots.slice(0, 3).map(async (slot, index) => { slot.direction = 'sendrecv'; await slot.sender.replaceTrack(tracks[index]); }));
  }
  private async offer(id: string, peer: Peer, iceRestart = false) {
    await peer.ready;
    if (this.closed || peer.pc.signalingState !== 'stable') return;
    await peer.pc.setLocalDescription(await peer.pc.createOffer({ iceRestart }));
    this.send(id, { description: peer.pc.localDescription!.toJSON() });
  }
  sync(meeting: Meeting) {
    this.meeting = meeting;
    const ids = new Set(meeting.participants.filter(p => p.socketId !== this.socket.id).map(p => p.socketId));
    for (const [id, peer] of this.peers) if (!ids.has(id)) { peer.pc.close(); this.peers.delete(id); }
    for (const id of ids) if (!this.peers.has(id)) {
      const peer = this.peer(id);
      if (this.socket.id! < id) void this.offer(id, peer).catch(error => { if (!this.closed) this.report(error.message); });
    }
    this.changed();
  }
  signal(from: string, signal: Signal) {
    if (this.closed) return;
    const peer = this.peer(from);
    peer.queue = peer.queue.then(async () => {
      await peer.ready;
      if (this.closed || peer.pc.signalingState === 'closed') return;
      if (signal.description) {
        await peer.pc.setRemoteDescription(signal.description);
        for (const candidate of peer.candidates.splice(0)) await peer.pc.addIceCandidate(candidate);
        if (signal.description.type === 'offer') {
          await this.bindTracks(peer.pc);
          await peer.pc.setLocalDescription(await peer.pc.createAnswer());
          this.send(from, { description: peer.pc.localDescription!.toJSON() });
        }
      } else if (signal.candidate) {
        if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(signal.candidate);
        else peer.candidates.push(signal.candidate);
      }
    }).catch(error => { if (!this.closed) this.report(`Media connection failed: ${error.message}`); });
  }
  async replace(slot: number, track: MediaStreamTrack | null) {
    await Promise.all([...this.peers.values()].map(async peer => { await peer.ready; await peer.pc.getTransceivers()[slot]?.sender.replaceTrack(track); }));
  }
  async camera(enabled: boolean, deviceId?: string) {
    let track: MediaStreamTrack | null = null;
    if (enabled) {
      // Camera drivers can take a moment to release capture after a quick
      // off/on toggle. Retry only that transition, never permission denial.
      for (let attempt = 0; attempt < 3; attempt++) {
        if (this.closed) return;
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: deviceId ? { deviceId: { exact: deviceId } } : { width: { ideal: 1280 }, height: { ideal: 720 } } });
          track = stream.getVideoTracks()[0]; break;
        } catch (error) {
          if (attempt === 2 || Date.now() - this.lastCameraStop > 5000 || !(error instanceof DOMException) || !['NotFoundError', 'NotReadableError'].includes(error.name)) throw error;
          await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)));
        }
      }
      if (!track) return;
      if (this.closed) { track.stop(); return; }
    }
    try { await this.replace(1, track); }
    catch (error) { track?.stop(); throw error; }
    this.local.getVideoTracks().forEach(old => { this.local.removeTrack(old); old.stop(); });
    if (!enabled) this.lastCameraStop = Date.now();
    if (track) this.local.addTrack(track);
    this.changed();
  }
  async microphone(deviceId: string) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId }, echoCancellation: true, noiseSuppression: true } });
    const track = stream.getAudioTracks()[0];
    if (this.closed) { track.stop(); return; }
    track.enabled = this.local.getAudioTracks()[0]?.enabled ?? true;
    try { await this.replace(0, track); }
    catch (error) { track.stop(); throw error; }
    this.local.getAudioTracks().forEach(old => { this.local.removeTrack(old); old.stop(); });
    this.local.addTrack(track); this.changed();
  }
  async share() {
    if (!navigator.mediaDevices.getDisplayMedia) throw new Error('Screen sharing is unavailable in this browser. Use a supported desktop browser.');
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false }); }
    catch (error) {
      if (error instanceof DOMException && error.name === 'NotAllowedError') throw new Error('Screen sharing was canceled or permission was denied.');
      throw error;
    }
    if (this.closed) { stream.getTracks().forEach(track => track.stop()); return; }
    this.display = stream;
    try { await this.replace(2, stream.getVideoTracks()[0]); }
    catch (error) { stream.getTracks().forEach(track => track.stop()); this.display = null; throw error; }
    stream.getVideoTracks()[0].onended = () => { void this.stopSharing().then(this.sharingStopped).catch(error => this.report(error.message)); };
    this.changed();
  }
  async stopSharing() {
    this.display?.getTracks().forEach(track => { track.onended = null; track.stop(); });
    this.display = null;
    await this.replace(2, null); this.changed();
  }
  close() {
    this.closed = true;
    this.peers.forEach(peer => peer.pc.close()); this.peers.clear();
    this.local.getTracks().forEach(track => track.stop());
    this.display?.getTracks().forEach(track => { track.onended = null; track.stop(); }); this.display = null;
  }
}

export function mediaError(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') return 'Permission was denied. Allow microphone/camera access in your browser and try again.';
    if (error.name === 'NotFoundError') return 'No matching microphone or camera was found. Check your devices or join with the camera off.';
    if (error.name === 'NotReadableError') return 'Your microphone or camera is in use by another app. Close it and try again.';
  }
  return error instanceof Error ? error.message : 'Unable to start media. Please try again.';
}
