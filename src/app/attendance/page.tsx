'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { attendanceGet as apiGet, attendancePost as apiPost } from '../../lib/attendanceApi';
import { COMPANY_TIME_ZONE, attendanceTime, shiftTime, shiftSimulationTimestamp, rosterIsCurrent, recordedShiftEnd, attendanceBlocksCheckIn, attendanceExpectation, attendanceDisplay, distanceMeters } from '../../lib/attendance';
import CompanyAttendanceHistory from '../../components/attendance/CompanyAttendanceHistory';
import {
  Clock,
  UserCheck,
  Calendar,
  AlertTriangle,
  Coins,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Sparkles,
  HelpCircle,
  Filter,
  Layers,
  MapPin,
  Navigation,
  MapPinOff,
  LocateFixed,
  Camera,
  RotateCcw,
  Smartphone,
  Eye,
  X,
  Laptop,
  Sliders,
  Check,
  Radio,
  Lock,
  UserX,
} from 'lucide-react';

export default function AttendancePage() {
  const { user, hasRole } = useAuth();
  const isCEO = user?.role === 'CEO' || hasRole('CEO');
  const canManageAttendance = hasRole('CEO', 'Super Admin');
  const [shift, setShift] = useState({ start: '09:00', end: '18:00', grace: 15, half: 60, full: 180 });
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPages, setHistoryPages] = useState(0);
  const [attendanceReady, setAttendanceReady] = useState(false);
  const [companyDay, setCompanyDay] = useState('');
  const [leaveBalances, setLeaveBalances] = useState<{ casual: number; sick: number; annual: number } | null>(null);
  const fetchSequence = useRef(0);
  const actionPending = useRef(false);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const cameraOpenRef = useRef(false);
  const cameraSequence = useRef(0);
  const [simulatedPhoto, setSimulatedPhoto] = useState(false);


  const [dailyAttendance, setTodayAttendance] = useState<any>(null);
  const [openAttendance, setOpenAttendance] = useState<any>(null);
  const todayAttendance = openAttendance || dailyAttendance;
  const todayDisplay = attendanceDisplay(todayAttendance);
  const [repairRequired, setRepairRequired] = useState<any[]>([]);
  const [personalSchedule, setPersonalSchedule] = useState<{ expectedCheckIn: string; scheduledCheckOut: string; halfDaySession: string | null } | null>(null);
  const [rosterReady, setRosterReady] = useState(false);
  const [attendanceRevision, setAttendanceRevision] = useState(0);
  const [officeLocation, setOfficeLocation] = useState<{
    officeAddress: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
    enforceLocation: boolean;
  } | null>(null);
  const [antiProxySettings, setAntiProxySettings] = useState<{
    enforceSingleDevicePerDay: boolean;
    requireSelfieVerification: boolean;
  }>({
    enforceSingleDevicePerDay: true,
    requireSelfieVerification: true,
  });

  const [history, setHistory] = useState<any[]>([]);
  const [historyError, setHistoryError] = useState('');
  const [roster, setRoster] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'self' | 'roster' | 'company-history'>('self');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [markingAbsentId, setMarkingAbsentId] = useState<string | null>(null);
  const [absentTarget, setAbsentTarget] = useState<{ id: string; name: string; date: string; expectedRecordId: string | null; expectedVersion: number | null } | null>(null);
  const overridePending = useRef(false);

  // CEO Simulation & Testing Sandbox State (Only accessible to CEO)
  const [simulatedHour, setSimulatedHour] = useState('now');
  const [simulatedLocation, setSimulatedLocation] = useState<'actual' | 'office' | 'home'>('actual');
  const [simulatedDevice, setSimulatedDevice] = useState<'actual' | 'secondary'>('actual');
  const [showCeoSimulator, setShowCeoSimulator] = useState(false);

  // Live Automatic Telemetry State
  const [deviceCoords, setDeviceCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [distanceToOffice, setDistanceToOffice] = useState<number | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'success' | 'error' | 'warning'; text: string; source?: 'load' } | null>(null);

  // Anti-Proxy: Unique Persistent Device ID Fingerprint
  const [deviceId, setDeviceId] = useState<string>('');

  // Anti-Proxy: Selfie Camera Modal State
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraStarting, setCameraStarting] = useState(false);

  // Photo Inspect Modal for CEO Audit
  const [inspectModal, setInspectModal] = useState<{
    isOpen: boolean;
    photo: string;
    userName: string;
    department: string;
    checkInTime: string;
    distance: string;
    deviceInfo: any;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Live Real-Time Digital Clock
  const [currentTime, setCurrentTime] = useState('');
  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString('en-US', { timeZone: COMPANY_TIME_ZONE, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Initialize or retrieve persistent Device ID
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        let storedId = localStorage.getItem('neximet_device_id');
        if (!storedId) {
          storedId = 'dev_' + crypto.randomUUID();
          localStorage.setItem('neximet_device_id', storedId);
        }
        setDeviceId(storedId);
      } catch { setMsg({ type: 'error', text: 'Enable browser storage to register this device for attendance.' }); }
    }
  }, []);

  // Haversine distance calculator
  const calculateDistance = distanceMeters;

  // Obtain real device GPS coordinates automatically
  const acquireLocation = async (): Promise<{ latitude: number; longitude: number } | null> => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setLocError('Geolocation is not supported by your browser.');
      return null;
    }
    setLocLoading(true);
    setLocError(null);
    setDeviceCoords(null);
    setDistanceToOffice(null);
    return new Promise(resolve => navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        setDeviceCoords(coords);
        setLocLoading(false);
        resolve(coords);
      },
      (err) => {
        setLocLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setLocError('Location permission denied. Please allow GPS location to verify office geofence.');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setLocError('GPS position unavailable. Please ensure location services are enabled.');
        } else if (err.code === err.TIMEOUT) {
          setLocError('Location request timed out. Please click "Refresh GPS".');
        } else {
          setLocError(`Could not detect GPS coordinates: ${err.message}`);
        }
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    ));
  };

  // Recalculate distance whenever coords, office location, or CEO simulation change
  useEffect(() => {
    if (!officeLocation) return;

    if (isCEO && simulatedLocation === 'office') {
      setDistanceToOffice(15); // Simulated inside office (15 meters)
    } else if (isCEO && simulatedLocation === 'home') {
      setDistanceToOffice(5840); // Simulated at home (5.8 km away)
    } else if (deviceCoords) {
      const dist = calculateDistance(
        deviceCoords.latitude,
        deviceCoords.longitude,
        officeLocation.latitude,
        officeLocation.longitude
      );
      setDistanceToOffice(dist);
    } else setDistanceToOffice(null);
  }, [deviceCoords, officeLocation, simulatedLocation, isCEO]);

  const fetchAttendanceData = async () => {
    if (!user?.id) return;
    const sequence = ++fetchSequence.current;
    setLoading(true);
    setRosterReady(false);
    try {
      const [todayRes, histRes, rosterRes] = await Promise.all([
        apiGet('/attendance/today'),
        apiGet(`/attendance/history?userId=${encodeURIComponent(user.id)}&page=${historyPage}&limit=20`),
        canManageAttendance ? apiGet('/attendance/roster') : Promise.resolve(null),
      ]);
      if (sequence !== fetchSequence.current) return;
      setAttendanceReady(!!todayRes.success);
      if (todayRes.success) {
        setTodayAttendance(todayRes.attendance);
        setOpenAttendance(todayRes.openAttendance || null);
        setRepairRequired(todayRes.repairRequired || []);
        setPersonalSchedule(todayRes.personalSchedule || null);
        setCompanyDay(todayRes.date);
        if (todayRes.leaveBalances) setLeaveBalances(todayRes.leaveBalances);
        setShift({ start: todayRes.shiftStartTime, end: todayRes.shiftEndTime, grace: todayRes.gracePeriodMinutes, half: todayRes.halfDayThresholdMinutes ?? 60, full: todayRes.fullDayAbsentThresholdMinutes ?? 180 });
        if (todayRes.officeLocation) {
          setOfficeLocation(todayRes.officeLocation);
        }
        if (todayRes.antiProxySettings) {
          setAntiProxySettings(todayRes.antiProxySettings);
        }
      } else { setTodayAttendance(null); setOpenAttendance(null); setPersonalSchedule(null); setCompanyDay(''); }

      if (histRes.success) {
        setHistoryError('');
        if (historyPage > Math.max(1, histRes.pages)) setHistoryPage(Math.max(1, histRes.pages));
        setHistory(histRes.records);
        setHistoryPages(histRes.pages);
      } else { setHistory([]); setHistoryPages(0); setHistoryError(histRes.message || 'Attendance history unavailable. Please refresh.'); }
      const currentRoster = rosterIsCurrent(todayRes, rosterRes);
      setRosterReady(currentRoster);
      setRoster(currentRoster ? rosterRes!.roster : []);
      if (todayRes.success && histRes.success) setAttendanceRevision(value => value + 1);
      const failure = [todayRes, histRes, rosterRes].find(result => result && !result.success);
      if (failure) setMsg({ type: 'error', source: 'load', text: failure.message || 'Unable to load attendance. Please retry.' });
      else if (canManageAttendance && !currentRoster) setMsg({ type: 'error', source: 'load', text: 'The working day changed while loading the roster. Refresh attendance before using administrator actions.' });
      else setMsg(previous => previous?.source === 'load' ? null : previous);
    } catch (err) {
      if (sequence !== fetchSequence.current) return;
      setAttendanceReady(false); setRosterReady(false); setRoster([]);
      setHistory([]); setHistoryPages(0);
      setHistoryError('Attendance history unavailable. Please refresh.');
      setMsg({ type: 'error', source: 'load', text: 'Attendance is unavailable. Please refresh before using attendance actions.' });
      console.error('Attendance fetch error:', err);
    } finally {
      if (sequence === fetchSequence.current) setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAttendanceData();
    const refresh = () => { if (document.visibilityState === 'visible' && !actionPending.current) void fetchAttendanceData(); };
    const timer = setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    return () => { fetchSequence.current++; clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [user?.id, user?.role, historyPage, canManageAttendance]);

  useEffect(() => { setHistoryPage(1); setActiveTab('self'); setTodayAttendance(null); setOpenAttendance(null); setPersonalSchedule(null); setRepairRequired([]); setHistory([]); setHistoryError(''); setRoster([]); setRosterReady(false); setLeaveBalances(null); setAttendanceReady(false); }, [user?.id, user?.role]);
  useEffect(() => {
    return () => { cameraOpenRef.current = false; cameraSequence.current++; cameraStreamRef.current?.getTracks().forEach(track => track.stop()); };
  }, []);
  useEffect(() => {
    if (cameraStream && videoRef.current && cameraModalOpen) {
      videoRef.current.srcObject = cameraStream;
      void videoRef.current.play().catch(error => { if (error.name !== 'AbortError') setCameraError('Camera preview could not start. Try again.'); });
    }
  }, [cameraStream, cameraModalOpen]);

  // Webcam Stream Management
  const startCamera = async () => {
    const sequence = ++cameraSequence.current;
    cameraStreamRef.current?.getTracks().forEach(track => track.stop());
    cameraStreamRef.current = null;
    setCameraStream(null);
    setCameraError(null);
    setCameraStarting(true);
    setCapturedPhoto(null);
    setSimulatedPhoto(false);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Webcam device not accessible in this browser.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 480 },
          height: { ideal: 360 },
        },
        audio: false,
      });
      if (sequence !== cameraSequence.current || !cameraOpenRef.current) { stream.getTracks().forEach(track => track.stop()); return; }
      cameraStreamRef.current = stream;
      setCameraStream(stream);
    } catch (err: any) {
      console.warn('Camera stream error:', err);
      if (sequence === cameraSequence.current && cameraOpenRef.current) setCameraError(
        err.message || 'Could not access webcam camera. Please check camera permissions in your browser.'
      );
    } finally {
      if (sequence === cameraSequence.current) setCameraStarting(false);
    }
  };

  const stopCamera = () => {
    cameraSequence.current++;
    cameraStreamRef.current?.getTracks().forEach(track => track.stop());
    cameraStreamRef.current = null;
    setCameraStream(null);
    setCameraStarting(false);
  };

  // Open camera modal and initialize stream
  const openSelfieModal = () => {
    cameraOpenRef.current = true;
    setCameraModalOpen(true);
    setCapturedPhoto(null);
    startCamera();
  };

  const closeSelfieModal = () => {
    cameraOpenRef.current = false;
    stopCamera();
    setCameraModalOpen(false);
    setCapturedPhoto(null);
    setCameraError(null);
  };

  // Capture video frame to canvas as base64 JPEG
  const handleTakeSnapshot = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) { setCameraError('Wait for the camera preview before taking a snapshot.'); return; }
      const scale = Math.min(1, 480 / Math.max(video.videoWidth, video.videoHeight));
      const width = Math.round(video.videoWidth * scale);
      const height = Math.round(video.videoHeight * scale);

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Mirror if user facing
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        setSimulatedPhoto(false);
        setCapturedPhoto(dataUrl);
        stopCamera();
      }
    }
  };

  // Generate a mock selfie snapshot (Restricted to CEO testing)
  const handleSimulateSelfie = () => {
    if (!isCEO) return;
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = 360;
      canvas.height = 270;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const grad = ctx.createLinearGradient(0, 0, 360, 270);
        grad.addColorStop(0, '#1E293B');
        grad.addColorStop(1, '#0F172A');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 360, 270);

        // Draw avatar circle
        ctx.beginPath();
        ctx.arc(180, 115, 55, 0, Math.PI * 2);
        ctx.fillStyle = '#5470F4';
        ctx.fill();

        // Draw initials
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 30px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const initials = user?.name ? user.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'ME';
        ctx.fillText(initials, 180, 115);

        // Draw timestamp & verified tag
        ctx.fillStyle = '#10B981';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText('CEO TEST SNAPSHOT', 180, 195);

        ctx.fillStyle = '#94A3B8';
        ctx.font = '11px monospace';
        ctx.fillText(attendanceTime(new Date()) + ' • Simulation', 180, 220);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedPhoto(dataUrl);
        setSimulatedPhoto(true);
        stopCamera();
      }
    }
  };

  // Trigger check-in initiation
  const initiateCheckIn = () => {
    if (actionPending.current || loading || !attendanceReady || attendanceBlocksCheckIn(todayAttendance)) return;
    if (antiProxySettings.requireSelfieVerification) {
      openSelfieModal();
    } else {
      executeCheckIn(null);
    }
  };

  // Submit Check-In Payload
  const executeCheckIn = async (photoPayload: string | null) => {
    if (actionPending.current || !attendanceReady || attendanceBlocksCheckIn(todayAttendance)) return;
    actionPending.current = true;
    setActionLoading(true);
    setMsg(null);
    let customTime: string | undefined = undefined;

    // CEO-only time simulation
    if (isCEO) {
      if (simulatedHour === 'on_time') {
        customTime = shiftSimulationTimestamp(shift.start, 0, companyDay);
      } else if (simulatedHour === 'grace') {
        customTime = shiftSimulationTimestamp(shift.start, Math.min(10, shift.grace), companyDay);
      } else if (simulatedHour === 'late_35') {
        customTime = shiftSimulationTimestamp(shift.start, Math.min(shift.grace + 20, shift.half - 0.5), companyDay);
      } else if (simulatedHour === 'half_day') {
        customTime = shiftSimulationTimestamp(shift.start, shift.half, companyDay);
      }
    }

    // Determine payload coordinates
    let lat: number | undefined = undefined;
    let lng: number | undefined = undefined;

    if (isCEO && simulatedLocation === 'office' && officeLocation) {
      lat = officeLocation.latitude;
      lng = officeLocation.longitude;
    } else if (isCEO && simulatedLocation === 'home' && officeLocation) {
      lat = officeLocation.latitude + 0.05; // Far away (Home)
      lng = officeLocation.longitude + 0.05;
    }

    // Determine device ID
    const activeDeviceId = (isCEO && simulatedDevice === 'secondary')
      ? 'dev_secondary_device_99'
      : deviceId;

    try {
      if (!(isCEO && simulatedLocation !== 'actual') && officeLocation?.enforceLocation) {
        const fresh = await acquireLocation();
        if (!fresh) { setMsg({ type: 'error', text: 'Fresh GPS location is required. Allow location access and try again.' }); return; }
        lat = fresh.latitude; lng = fresh.longitude;
      }
      const res = await apiPost('/attendance/check-in', {
        customTime,
        simulated: isCEO && (!!customTime || simulatedLocation !== 'actual' || simulatedDevice !== 'actual' || simulatedPhoto),
        latitude: lat,
        longitude: lng,
        deviceId: activeDeviceId,
        deviceType: typeof navigator !== 'undefined' && navigator.userAgent.includes('Mobile') ? 'Mobile Device' : 'Desktop / Laptop',
        browser: typeof navigator !== 'undefined' && navigator.userAgent.includes('Chrome') ? 'Google Chrome' : navigator.userAgent.includes('Firefox') ? 'Mozilla Firefox' : 'Web Browser',
        photo: photoPayload || undefined,
      });

      if (res.success) {
        setMsg({ type: 'success', text: res.message || 'Check-in successfully recorded with live GPS & anti-proxy verification!' });
        closeSelfieModal();
        fetchAttendanceData();
      } else {
        setMsg({ type: 'error', text: res.message || 'Check-in rejected' });
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: err?.message || 'Check-in error occurred' });
    } finally {
      actionPending.current = false;
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (actionPending.current || !attendanceReady || todayAttendance?.quarantine?.at) return;
    actionPending.current = true; setActionLoading(true); setMsg(null);
    try {
      const res = await apiPost('/attendance/check-out', {});
      setMsg({ type: res.success ? 'success' : 'error', text: res.message || 'Unable to close shift.' });
      await fetchAttendanceData();
    } finally { actionPending.current = false; setActionLoading(false); }
  };

  const inspectPhoto = async (recordId: string, userName: string, department: string) => {
    const res = await apiGet(`/attendance/records/${recordId}/photo`);
    if (!res.success || !res.attendance?.photo) { setMsg({ type: 'error', text: res.message || 'No selfie available.' }); return; }
    const record = res.attendance;
    setInspectModal({ isOpen: true, photo: record.photo, userName, department, checkInTime: attendanceTime(record.checkIn),
      distance: record.location?.isVerified ? `${record.location.distanceMeters}m` : 'GPS not verified', deviceInfo: record.deviceInfo });
  };

  // CEO / Admin Mark Employee Absent (revert attendance)
  const handleMarkAbsent = (targetUserId: string, userName?: string, date = companyDay) => {
    if (overridePending.current || !canManageAttendance || !attendanceReady || loading || date !== companyDay || (targetUserId !== user?.id && !rosterReady)) return;
    if (!date) { setMsg({ type: 'error', text: 'Reload attendance before applying an override.' }); return; }
    const selected = targetUserId === user?.id ? dailyAttendance : roster.find(row => row.user._id === targetUserId);
    if (selected?.quarantine?.at) { setMsg({ type: 'error', text: 'Repair this attendance record in Company Attendance History before applying an override.' }); return; }
    setAbsentTarget({ id: targetUserId, name: userName || 'this employee', date, ...attendanceExpectation(selected) });
  };
  const confirmMarkAbsent = async () => {
    if (!absentTarget || overridePending.current || !canManageAttendance) return;
    if (!attendanceReady || loading || absentTarget.date !== companyDay || (absentTarget.id !== user?.id && !rosterReady)) { setAbsentTarget(null); setMsg({ type: 'error', text: 'Attendance changed or the roster is unavailable. Refresh before applying an override.' }); return; }
    const targetUserId = absentTarget.id;
    overridePending.current = true;
    setMarkingAbsentId(targetUserId);
    setMsg(null);
    try {
      const res = await apiPost('/attendance/mark-absent', { userId: targetUserId, date: absentTarget.date, expectedRecordId: absentTarget.expectedRecordId, expectedVersion: absentTarget.expectedVersion });
      if (res.success) {
        setMsg({ type: 'success', text: res.message || 'Employee marked absent successfully.' });
        await fetchAttendanceData();
      } else {
        setMsg({ type: 'error', text: res.message || 'Failed to mark employee absent' });
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: err?.message || 'Error occurred while marking employee absent' });
    } finally {
      overridePending.current = false;
      setMarkingAbsentId(null);
      setAbsentTarget(null);
    }
  };

  // CEO / Admin Re-mark Employee Present
  const handleMarkPresent = async (targetUserId: string, userName?: string, date = companyDay) => {
    if (overridePending.current || !canManageAttendance || !attendanceReady || loading || !rosterReady || date !== companyDay) return;
    if (roster.find(row => row.user._id === targetUserId)?.quarantine?.at) { setMsg({ type: 'error', text: 'Repair this attendance record in Company Attendance History before applying an override.' }); return; }
    overridePending.current = true;
    setMarkingAbsentId(targetUserId);
    setMsg(null);
    try {
      const selected = roster.find(row => row.user._id === targetUserId);
      const res = await apiPost('/attendance/mark-present', { userId: targetUserId, date, ...attendanceExpectation(selected) });
      if (res.success) {
        setMsg({ type: 'success', text: res.message || `${userName || 'Employee'} marked present successfully.` });
        await fetchAttendanceData();
      } else {
        setMsg({ type: 'error', text: res.message || 'Failed to mark employee present' });
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: err?.message || 'Error occurred while marking employee present' });
    } finally {
      overridePending.current = false;
      setMarkingAbsentId(null);
    }
  };

  const detectedDeviceName = typeof navigator !== 'undefined'
    ? navigator.userAgent.includes('Mobile')
      ? 'Mobile Device'
      : 'Workstation / Laptop'
    : 'Authenticated Device';

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Hidden canvas for snapshot rendering */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Header & Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-[#5470F4]" />
            <span>Attendance & Clock-In Management</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            GPS geofencing, browser device lock, selfie capture, and attendance deductions. Times use Asia/Karachi.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <button disabled={loading || actionLoading} onClick={() => void fetchAttendanceData()} className="rounded-xl border border-[#1F293D] px-3 py-2.5 text-xs text-gray-300 disabled:opacity-50">Refresh Attendance</button>
          <div className="bg-[#111827] border border-[#1F293D] px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-2xl flex items-center gap-2.5 shadow-sm">
            <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-purple-400 animate-pulse shrink-0" />
            <div className="text-xs">
              <span className="text-gray-400 block text-[9px] sm:text-[10px]">Anti-Proxy Shield</span>
              <span className="text-white font-bold text-[11px] sm:text-xs">{antiProxySettings.enforceSingleDevicePerDay ? 'Device Lock' : 'Device Lock Off'} · {antiProxySettings.requireSelfieVerification ? 'Selfie Required' : 'Selfie Optional'}</span>
            </div>
          </div>

          <div className="bg-[#111827] border border-[#1F293D] px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-2xl flex items-center gap-2.5 shadow-sm">
            <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <div className="text-xs">
              <span className="text-gray-400 block text-[9px] sm:text-[10px]">Active Shift</span>
              <span className="text-white font-bold text-[11px] sm:text-xs">{shiftTime(shift.start)} – {shiftTime(shift.end)} ({shift.grace}m Grace)</span>
            </div>
          </div>
        </div>
      </div>

      {msg && (
        <div className={`p-3.5 sm:p-4 rounded-2xl border text-xs font-semibold flex items-center gap-2.5 ${msg.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : msg.type === 'warning'
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}>
          {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <span className="leading-relaxed">{msg.text}</span>
        </div>
      )}
      {repairRequired.length > 0 && <p role="status" className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-200">{repairRequired.length} attendance record(s) need administrator review. {todayAttendance?.quarantine?.at ? 'Clock actions for this record remain unavailable until it is repaired.' : 'Other valid attendance days can still be recorded.'} {canManageAttendance ? 'Review the records in Company Attendance History.' : 'Contact the CEO or Super Admin to review these records.'}</p>}

      {/* Main Terminal & Leave Balance Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Interactive Check-In / Check-Out Station */}
        <div className="lg:col-span-2 bg-[#111827] border border-[#1F293D] rounded-3xl p-4 sm:p-6 lg:p-8 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-[#1F293D] pb-4">
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-[#5470F4]" />
              <span>Personal Time Terminal</span>
            </h3>
            <span className="text-xs font-mono font-bold text-[#5CC5FA] bg-[#161F30] px-3 py-1 rounded-xl border border-[#1F293D]">
              {currentTime || '09:00:00 AM'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* Today's Status Details */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">Attendance Day: {todayAttendance?.date || companyDay || 'Loading…'}</span>
                  {openAttendance && openAttendance.date !== companyDay && <p className="mt-1 text-xs text-amber-300">Close this earlier open shift before starting the new attendance day.</p>}
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs sm:text-sm font-bold px-3 py-1 rounded-xl ${todayDisplay.tone === 'danger' ? 'bg-rose-500/20 text-rose-300' : todayDisplay.tone === 'warning' ? 'bg-amber-500/20 text-amber-300' : todayDisplay.tone === 'info' ? 'bg-blue-500/20 text-blue-300' : todayDisplay.tone === 'success' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gray-500/20 text-gray-400'}`}>
                      {todayDisplay.label}
                    </span>
                  </div>
                  {personalSchedule?.halfDaySession && (!openAttendance || openAttendance.date === companyDay) && <p className="mt-2 text-xs text-blue-300">Approved {personalSchedule.halfDaySession} leave · Expected arrival {attendanceTime(todayAttendance?.expectedCheckIn || personalSchedule.expectedCheckIn)} · Shift ends {recordedShiftEnd(todayAttendance?.scheduledCheckOut ? todayAttendance : personalSchedule, shift.end)}.</p>}
                </div>

                {/* Selfie Thumbnail if checked in with photo */}
                {todayAttendance?.photo && (
                  <div className="relative group cursor-pointer" onClick={() => setInspectModal({
                    isOpen: true,
                    photo: todayAttendance.photo,
                    userName: user?.name || 'You',
                    department: user?.department || '',
                    checkInTime: attendanceTime(todayAttendance.checkIn),
                    distance: todayAttendance.location?.isVerified ? `${todayAttendance.location.distanceMeters}m` : 'GPS not verified',
                    deviceInfo: todayAttendance.deviceInfo,
                  })}>
                    <img
                      src={todayAttendance.photo}
                      alt="Today's Check-in Selfie"
                      className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl object-cover border-2 border-emerald-400/50 shadow-md group-hover:scale-105 transition-transform"
                    />
                    <span className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5 shadow">
                      <Camera className="w-2.5 h-2.5" />
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-[#161F30] border border-[#1F293D]">
                  <span className="text-gray-400 text-[10px] block font-semibold">Check-In</span>
                  <span className="font-bold text-white text-sm">
                    {todayAttendance?.checkIn
                      ? attendanceTime(todayAttendance.checkIn)
                      : '--:--'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#161F30] border border-[#1F293D]">
                  <span className="text-gray-400 text-[10px] block font-semibold">Office Shift End</span>
                  <span className="font-bold text-[#5CC5FA] text-sm">
                    {recordedShiftEnd(todayAttendance?.checkIn ? todayAttendance : personalSchedule, shift.end)} (Closing)
                  </span>
                </div>
              </div>

              {/* Deduction Indicator for Today */}
              {todayAttendance && todayAttendance.deductionAmount > 0 && (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-rose-400 flex items-center gap-1.5">
                      <Coins className="w-3.5 h-3.5" />
                      <span>{todayAttendance.quarantine?.at || todayAttendance.isSimulated ? 'Recorded Amount (Excluded from Totals)' : 'Penalty Applied'}</span>
                    </span>
                    <span className="font-black text-white text-sm">
                      -PKR {todayAttendance.deductionAmount} ({todayAttendance.deductionPercentage}%)
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-300 leading-relaxed">{todayAttendance.deductionReason}</p>
                </div>
              )}

              {/* Verified Location & Anti-Proxy Stamp */}
              {todayAttendance?.location?.isVerified && (
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-1">
                  <div className="flex items-center justify-between text-emerald-400 font-bold text-[11px]">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Office GPS Confirmed</span>
                    </span>
                    <span>{todayAttendance.location.distanceMeters !== null ? `${todayAttendance.location.distanceMeters}m` : 'In Range'}</span>
                  </div>
                  <p className="text-[10px] text-gray-400 truncate">
                    {todayAttendance.location.officeAddress || 'Neximet Head Office'}
                  </p>
                </div>
              )}
            </div>

            {/* Actions & Automatic Telemetry Station */}
            <div className="space-y-4 bg-[#161F30]/70 p-4 sm:p-5 rounded-2xl border border-[#1F293D]">
              {/* Automated Office Geofencing Live Radar */}
              <div className="p-3 rounded-xl bg-[#0B0F19] border border-[#1F293D] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-300 font-bold flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#5470F4]" />
                    <span>Live Office GPS Geofence</span>
                  </span>
                  <button
                    onClick={acquireLocation}
                    disabled={locLoading}
                    className="text-[10px] text-[#5CC5FA] hover:underline flex items-center gap-1 font-semibold"
                    title="Refresh GPS location"
                  >
                    <LocateFixed className={`w-3 h-3 ${locLoading ? 'animate-spin' : ''}`} />
                    <span>{locLoading ? 'Locating...' : 'Refresh GPS'}</span>
                  </button>
                </div>

                {/* Live Distance & Boundary Status */}
                {distanceToOffice !== null ? (
                  <div className="space-y-1.5">
                    <div className={`p-2 rounded-lg text-xs font-semibold flex items-center justify-between ${distanceToOffice <= (officeLocation?.radiusMeters || 200)
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                      }`}>
                      <span className="flex items-center gap-1.5">
                        {distanceToOffice <= (officeLocation?.radiusMeters || 200) ? (
                          <Navigation className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <MapPinOff className="w-3.5 h-3.5 text-rose-400" />
                        )}
                        <span className="text-[11px] sm:text-xs">
                          {distanceToOffice <= (officeLocation?.radiusMeters || 200)
                            ? 'Inside Office Premises'
                            : 'Outside Office Geofence'}
                        </span>
                      </span>
                      <span className="font-mono font-bold text-xs">{distanceToOffice}m</span>
                    </div>

                    {deviceCoords && (
                      <div className="flex items-center justify-between text-[10px] text-gray-400 px-1 font-mono">
                        <span>Lat: {deviceCoords.latitude.toFixed(4)}°</span>
                        <span>Lng: {deviceCoords.longitude.toFixed(4)}°</span>
                      </div>
                    )}
                  </div>
                ) : locError ? (
                  <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 space-y-1">
                    <p>{locError}</p>
                    <button
                      onClick={acquireLocation}
                      className="text-[10px] text-[#5CC5FA] underline block font-semibold"
                    >
                      Click here to retry GPS permission
                    </button>
                  </div>
                ) : (
                  <div className="p-2 rounded-lg bg-[#161F30] text-[11px] text-gray-400 flex items-center gap-2">
                    <LocateFixed className={`w-3.5 h-3.5 text-[#5CC5FA] ${locLoading ? 'animate-spin' : ''}`} />
                    <span>{locLoading ? 'Acquiring fresh GPS coordinates…' : officeLocation?.enforceLocation ? 'GPS refreshes when you clock in. Use Refresh GPS to check your location.' : 'Office GPS verification is disabled by policy.'}</span>
                  </div>
                )}
              </div>

              {/* Automatic Device Identification & Lock */}
              <div className="p-3 rounded-xl bg-[#0B0F19] border border-[#1F293D] space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-gray-300">
                  <span className="flex items-center gap-1.5 font-bold">
                    <Laptop className="w-3.5 h-3.5 text-[#5CC5FA]" />
                    <span>Browser Device</span>
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20 flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" />
                    <span>{antiProxySettings.enforceSingleDevicePerDay ? 'Device Lock Enabled' : 'Device Lock Off'}</span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-gray-400 pt-0.5">
                  <span>{detectedDeviceName}</span>
                  <span className="font-mono text-white font-semibold">
                    {deviceId ? deviceId.substring(0, 12) + '...' : 'Registering...'}
                  </span>
                </div>
              </div>

              {/* CEO-Exclusive Sandbox Testing Panel (Hidden for all other users) */}
              {isCEO && (
                <div className="pt-2 border-t border-[#1F293D] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5" />
                      <span>CEO QA Testing Sandbox</span>
                    </span>
                    <button
                      onClick={() => setShowCeoSimulator(!showCeoSimulator)}
                      className="text-[10px] text-[#5CC5FA] hover:underline font-semibold"
                    >
                      {showCeoSimulator ? 'Hide Controls' : 'Show Simulator'}
                    </button>
                  </div>

                  {showCeoSimulator && (
                    <div className="p-3 rounded-xl bg-[#0B0F19] border border-amber-500/30 space-y-2.5 animate-in fade-in duration-150">
                      <div>
                        <label className="text-[11px] font-bold text-gray-300 block mb-1">
                          Shift Time Simulator:
                        </label>
                        <select
                          value={simulatedHour}
                          onChange={(e) => setSimulatedHour(e.target.value)}
                          className="w-full bg-[#161F30] border border-[#1F293D] focus:border-amber-400 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none"
                        >
                          <option value="now">Real-Time Machine Clock (Default)</option>
                          <option value="on_time">At Shift Start (On Time)</option>
                          <option value="grace">Within the Configured Grace Window</option>
                          <option value="late_35">Late, Before the Half-Day Threshold</option>
                          <option value="half_day">At the Half-Day Threshold</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-gray-300 block mb-1">
                            GPS Geofence:
                          </label>
                          <select
                            value={simulatedLocation}
                            onChange={(e) => setSimulatedLocation(e.target.value as any)}
                            className="w-full bg-[#161F30] border border-[#1F293D] rounded-xl px-2 py-1.5 text-[11px] text-white outline-none"
                          >
                            <option value="actual">Live GPS (Default)</option>
                            <option value="office">At Office (15m)</option>
                            <option value="home">At Home (5.8km away)</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-gray-300 block mb-1">
                            Device Test:
                          </label>
                          <select
                            value={simulatedDevice}
                            onChange={(e) => setSimulatedDevice(e.target.value as any)}
                            className="w-full bg-[#161F30] border border-[#1F293D] rounded-xl px-2 py-1.5 text-[11px] text-white outline-none"
                          >
                            <option value="actual">My Device ({deviceId.substring(0, 6)})</option>
                            <option value="secondary">Shared Device (Conflict)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                {todayAttendance?.financialReviewRequired && !attendanceBlocksCheckIn(todayAttendance) && <p className="text-xs text-amber-300">No check-in was recorded by shift end. You can still record your actual arrival; administrators review any absence deduction.</p>}
                {todayAttendance?.quarantine?.at ? (
                  <p role="alert" className="p-3 rounded-xl bg-amber-500/10 text-xs text-amber-300">This attendance record requires administrator repair before clock actions can continue. {canManageAttendance ? 'Review the record in Company Attendance History.' : 'Contact the CEO or Super Admin to review this record.'}</p>
                ) : attendanceBlocksCheckIn(todayAttendance) ? (
                  <p className="p-3 rounded-xl bg-rose-500/10 text-xs text-rose-300">Attendance was marked absent. Contact an administrator to restore it.</p>
                ) : !todayAttendance?.checkIn ? (
                  <button
                    onClick={initiateCheckIn}
                    disabled={actionLoading || loading || !attendanceReady || (antiProxySettings.enforceSingleDevicePerDay && !deviceId)}
                    className="w-full py-3 sm:py-3.5 rounded-xl text-xs sm:text-sm font-bold gradient-btn text-white shadow-lg shadow-[#5470F4]/30 flex items-center justify-center gap-2 hover:scale-[1.01] transition-all disabled:opacity-50"
                  >
                    <Camera className="w-4 h-4" />
                    <span>{actionLoading ? 'Recording Clock-In…' : antiProxySettings.requireSelfieVerification ? 'Capture Selfie & Clock In' : 'Clock In'}</span>
                  </button>
                ) : (
                  <div className="space-y-2">
                    <div className="p-3 text-center bg-[#0B0F19] rounded-xl border border-emerald-500/30 text-xs font-semibold text-emerald-400 space-y-1">
                      <div className="flex items-center justify-center gap-1.5 font-bold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>{todayAttendance.checkOut ? 'Shift Closed' : 'Check-In Recorded'}</span>
                      </div>
                      <p className="text-[11px] text-gray-400 font-normal">
                        {todayAttendance.checkOut ? `${attendanceTime(todayAttendance.checkOut)} · ${todayAttendance.totalWorkHours} hours worked` : `Shift end is ${recordedShiftEnd(todayAttendance, shift.end)}. Close your shift when leaving; overdue shifts use the recorded scheduled end time.`}
                      </p>
                    </div>

                    {!todayAttendance.checkOut && <button onClick={() => void handleCheckOut()} disabled={actionLoading || loading || !attendanceReady} className="w-full py-3 rounded-xl text-xs font-bold bg-[#5470F4] text-white disabled:opacity-50">{actionLoading ? 'Closing Shift…' : 'Clock Out'}</button>}
                    {todayAttendance.isSimulated && <p className="text-xs text-amber-300">CEO simulation — GPS evidence is not verified.</p>}
                    {canManageAttendance && (
                      <button
                        onClick={() => handleMarkAbsent(user?.id || (user as any)?._id, 'Yourself')}
                        disabled={markingAbsentId === (user?.id || (user as any)?._id) || loading || !attendanceReady || todayAttendance.date !== companyDay}
                        className="w-full py-2.5 rounded-xl text-xs font-bold bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 border border-rose-500/30 flex items-center justify-center gap-1.5 transition-all shadow-sm"
                        title="Administrator override: mark absent"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        <span>{markingAbsentId === (user?.id || (user as any)?._id) ? 'Updating...' : 'Mark Absent (Admin Override)'}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Holidays & Leaves Left Balance Card */}
        <div className="bg-[#111827] border border-[#1F293D] rounded-3xl p-4 sm:p-6 lg:p-8 shadow-xl space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#1F293D] pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-400" />
                <span>Your Holidays Left</span>
              </h3>
              <span className="text-[11px] font-bold text-purple-300 bg-purple-500/10 px-2.5 py-0.5 rounded-full border border-purple-500/20">
                2026 Quota
              </span>
            </div>

            <div className="text-center py-2">
              <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                {((leaveBalances ?? user?.leaveBalances)?.casual || 0) + ((leaveBalances ?? user?.leaveBalances)?.sick || 0) + ((leaveBalances ?? user?.leaveBalances)?.annual || 0)}
              </span>
              <span className="text-xs text-gray-400 block mt-0.5">Total Days Remaining</span>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#161F30] border border-[#1F293D] text-xs">
                <span className="text-gray-300 font-medium">Casual Leaves</span>
                <span className="font-bold text-white font-mono">{(leaveBalances ?? user?.leaveBalances)?.casual || 0} days</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-[#161F30] border border-[#1F293D] text-xs">
                <span className="text-gray-300 font-medium">Medical / Sick Leaves</span>
                <span className="font-bold text-white font-mono">{(leaveBalances ?? user?.leaveBalances)?.sick || 0} days</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-[#161F30] border border-[#1F293D] text-xs">
                <span className="text-gray-300 font-medium">Annual Paid Vacations</span>
                <span className="font-bold text-white font-mono">{(leaveBalances ?? user?.leaveBalances)?.annual || 0} days</span>
              </div>
            </div>
          </div>

          <a
            href="/leaves"
            className="w-full py-2.5 rounded-xl text-xs font-bold text-center bg-[#1F293D] hover:bg-[#5470F4] text-white transition-all block mt-2"
          >
            Apply for Time Off →
          </a>
        </div>
      </div>

      {/* Toggle View: My Attendance Log vs Daily Team Roster */}
      <div className="bg-[#111827] border border-[#1F293D] rounded-3xl p-4 sm:p-6 lg:p-8 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1F293D] pb-4">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              onClick={() => setActiveTab('self')}
              className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'self'
                  ? 'bg-[#5470F4] text-white shadow-md shadow-[#5470F4]/30'
                  : 'text-gray-400 hover:text-white hover:bg-[#161F30]'
                }`}
            >
              My Attendance History
            </button>

            {hasRole('CEO', 'Super Admin') && (
              <button
                onClick={() => setActiveTab('roster')}
                className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'roster'
                    ? 'bg-[#5470F4] text-white shadow-md shadow-[#5470F4]/30'
                    : 'text-gray-400 hover:text-white hover:bg-[#161F30]'
                  }`}
              >
              Today's Company Roster ({rosterReady ? `${roster.length} Staff` : loading ? 'Loading…' : 'Unavailable'})
              </button>
            )}
            {canManageAttendance && <button onClick={() => setActiveTab('company-history')}
              className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'company-history' ? 'bg-[#5470F4] text-white shadow-md shadow-[#5470F4]/30' : 'text-gray-400 hover:text-white hover:bg-[#161F30]'}`}>
              Company Attendance History
            </button>}
          </div>
        </div>

        {/* Tab 1: Personal History Table */}
        {activeTab === 'self' && <div className="flex flex-wrap items-center justify-between gap-3 mb-3 text-xs">
          <span className="text-gray-400">Page {historyPage} of {Math.max(1, historyPages)}</span>
          <div className="flex gap-2">
            <button disabled={loading || historyPage <= 1} onClick={() => setHistoryPage(page => page - 1)} className="px-3 py-2 rounded-xl bg-[#161F30] text-white disabled:opacity-40">Previous</button>
            <button disabled={loading || historyPage >= historyPages} onClick={() => setHistoryPage(page => page + 1)} className="px-3 py-2 rounded-xl bg-[#161F30] text-white disabled:opacity-40">Next</button>
          </div>
        </div>}
        {!attendanceReady && !loading && <button onClick={() => void fetchAttendanceData()} className="px-3 py-2 mb-3 rounded-xl bg-[#5470F4] text-white text-xs">Retry attendance</button>}

        {activeTab === 'self' ? (
          <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
            <table className="w-full text-left text-xs min-w-[720px]">
              <thead className="text-gray-400 uppercase tracking-wider font-bold border-b border-[#1F293D] bg-[#0B0F19]">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Selfie Snapshot</th>
                  <th className="py-3 px-4">Check-In</th>
                  <th className="py-3 px-4">Shift End</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Late Delay</th>
                  <th className="py-3 px-4">Deduction</th>
                  <th className="py-3 px-4">Reason / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F293D]">
                {history && history.length > 0 ? (
                  history.map((record: any) => (
                    <tr key={record._id} className="hover:bg-[#161F30]/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-gray-300 font-semibold">{record.date}</td>
                      <td className="py-3.5 px-4">
                        {record.hasPhoto ? (
                          <button onClick={() => void inspectPhoto(record._id, user?.name || 'You', user?.department || '')}
                            className="p-2.5 rounded-xl border border-emerald-400/40 text-emerald-300" aria-label="View attendance selfie">
                            <Camera className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="text-gray-500 font-mono text-[10px]">--</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-white">
                        {attendanceTime(record.checkIn)}
                      </td>
                      <td className="py-3.5 px-4 text-gray-400 font-mono">
                        {attendanceTime(record.checkOut || record.scheduledCheckOut)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold capitalize ${record.status === 'present'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : record.status === 'half_day'
                              ? 'bg-rose-500/20 text-rose-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}>
                          {record.quarantine?.at ? 'Needs Attendance Repair' : record.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-gray-300">
                        {record.minutesLate > 0 ? (
                          <span className="text-amber-400 font-bold">{record.minutesLate} mins late</span>
                        ) : (
                          <span className="text-gray-400">{record.checkIn ? 'No late mark' : '--'}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {record.deductionAmount > 0 ? (
                          <span className="text-rose-400 font-bold font-mono">-PKR {record.deductionAmount}</span>
                        ) : (
                          <span className="text-gray-500">PKR 0</span>
                        )}
                        {(record.quarantine?.at || record.isSimulated) && <span className="mt-1 block text-[10px] text-amber-300">Excluded from totals</span>}
                      </td>
                      <td className="py-3.5 px-4 text-gray-400 max-w-xs truncate">
                        {record.deductionReason || record.notes || 'Normal attendance'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-500">
                      {historyError ? 'Attendance history unavailable. Refresh attendance to retry.' : 'No attendance history recorded yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : activeTab === 'company-history' && canManageAttendance ? (
          <CompanyAttendanceHistory workingDay={companyDay} refreshToken={attendanceRevision} inspectPhoto={inspectPhoto} onChanged={fetchAttendanceData} />
        ) : (
          /* Tab 2: Company Roster View with Anti-Proxy Inspection for CEO */
          <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
            <table className="w-full text-left text-xs min-w-[800px]">
              <thead className="text-gray-400 uppercase tracking-wider font-bold border-b border-[#1F293D] bg-[#0B0F19]">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Live Selfie</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Check-In</th>
                  <th className="py-3 px-4">Anti-Proxy & Location</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Late Mins</th>
                  <th className="py-3 px-4">Deduction</th>
                  <th className="py-3 px-4 text-right">Admin Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F293D]">
                {roster.map((item: any) => (
                  <tr key={item.user._id} className="hover:bg-[#161F30]/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#161F30] to-[#1E293D] border border-[#5470F4]/30 flex items-center justify-center font-bold text-[11px] text-[#5CC5FA] shrink-0">
                          {item.user?.name ? item.user.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'US'}
                        </div>
                        <div>
                          <p className="font-bold text-white">{item.user.name}</p>
                          <p className="text-[10px] text-gray-400">{item.user.designation}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {item.hasPhoto ? (
                        <button onClick={() => void inspectPhoto(item.recordId, item.user.name, item.user.department)}
                          className="p-2.5 rounded-xl border border-purple-400/40 text-purple-300" aria-label={`View selfie for ${item.user.name}`}>
                          <Camera className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="text-gray-500 font-mono text-[10px]">No Photo</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-gray-300">{item.user.department}</td>
                    <td className="py-3.5 px-4 font-mono text-white">
                      {item.checkIn ? attendanceTime(item.checkIn) : 'Not yet'}
                    </td>
                    <td className="py-3.5 px-4">
                      {item.deviceLocked ? (
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            <span>1-Device Locked</span>
                          </span>
                          {item.location?.distanceMeters != null && (
                            <span className="text-[10px] text-gray-400 block font-mono">
                              {item.location.distanceMeters}m from office
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-500 text-[10px]">--</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold capitalize ${item.status === 'present'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : item.status === 'half_day'
                            ? 'bg-rose-500/20 text-rose-300'
                            : item.status === 'late'
                              ? 'bg-amber-500/20 text-amber-300'
                              : item.status === 'absent'
                                ? 'bg-rose-500/20 text-rose-400'
                                : 'bg-gray-500/20 text-gray-400'
                        }`}>
                        {item.quarantine?.at ? 'Needs Attendance Repair' : item.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-gray-300">
                      {item.minutesLate > 0 ? `${item.minutesLate} mins` : '--'}
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      {item.deductionAmount > 0 ? (
                        <span className="text-rose-400 font-bold">-PKR {item.deductionAmount}</span>
                      ) : (
                        <span className="text-gray-500">PKR 0</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {canManageAttendance ? (
                        item.quarantine?.at ? <button className="px-3 py-2.5 rounded-xl text-xs font-semibold text-amber-300 bg-amber-500/10" onClick={() => setActiveTab('company-history')}>Review in History</button> : item.financialReviewRequired || (item.status !== 'absent' && (item.checkedIn || ['present', 'late', 'half_day', 'not_checked_in'].includes(item.status))) ? (
                          <>
                          <button
                            onClick={() => handleMarkAbsent(item.user._id, item.user.name, item.date)}
                            disabled={!!markingAbsentId || loading || !rosterReady || item.date !== companyDay}
                            className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 border border-rose-500/30 transition-all inline-flex items-center gap-1.5 shadow-sm hover:scale-[1.02] disabled:opacity-50 cursor-pointer"
                            title="Mark this employee absent for today"
                          >
                            <UserX className="w-3.5 h-3.5 text-rose-400" />
                            <span>{markingAbsentId === item.user._id ? 'Updating...' : item.financialReviewRequired ? 'Review Absence' : 'Mark Absent'}</span>
                          </button>
                          {item.financialReviewRequired && <button disabled={!!markingAbsentId || loading || !rosterReady || item.date !== companyDay} onClick={() => void handleMarkPresent(item.user._id, item.user.name, item.date)} className="ml-2 px-2.5 py-1.5 text-xs font-semibold text-emerald-300">Mark Present</button>}
                          </>
                        ) : item.status === 'absent' ? (
                          <div className="inline-flex items-center gap-2">
                            <span className="text-[10px] font-bold text-rose-400 bg-rose-500/15 px-2 py-0.5 rounded-lg border border-rose-500/30">
                              Marked Absent
                            </span>
                            <button
                              onClick={() => handleMarkPresent(item.user._id, item.user.name, item.date)}
                              disabled={!!markingAbsentId || loading || !rosterReady || item.date !== companyDay}
                              className="text-[10px] text-emerald-400 hover:underline font-semibold cursor-pointer"
                              title="Restore original attendance"
                            >
                              {item.override?.type === 'absent' ? 'Restore' : 'Mark Present'}
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-500 font-mono text-[10px]">--</span>
                        )
                      ) : (
                        <span className="text-gray-500 font-mono text-[10px]">--</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {absentTarget && <div className="portal-modal fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-3 sm:p-4">
        <div role="dialog" aria-modal="true" aria-label="Confirm absence override" className="my-auto w-full max-w-md space-y-4 rounded-3xl border border-[#1F293D] bg-[#111827] p-5 sm:p-6"
          onKeyDown={event => {
            if (event.key === 'Escape' && !overridePending.current) setAbsentTarget(null);
            if (event.key === 'Tab') {
              const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
              const first = buttons[0], last = buttons[buttons.length - 1];
              if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
              else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
            }
          }}>
          <h3 className="text-base font-bold text-white">Mark {absentTarget.name} absent for {absentTarget.date}?</h3>
          <p className="text-xs leading-relaxed text-gray-300">This applies the configured absence deduction after approved leave, holidays and days off are considered. Original check-in, check-out and selfie evidence stay available. An administrator can restore the previous attendance.</p>
          <div className="flex flex-wrap justify-end gap-3">
            <button autoFocus disabled={!!markingAbsentId} onClick={() => setAbsentTarget(null)} className="rounded-xl bg-[#161F30] px-4 py-2.5 text-xs font-semibold text-gray-300 disabled:opacity-50">Cancel</button>
            <button disabled={!!markingAbsentId} onClick={() => void confirmMarkAbsent()} className="rounded-xl bg-rose-500 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{markingAbsentId ? 'Updating…' : 'Confirm Absence'}</button>
          </div>
        </div>
      </div>}

      {/* MODAL 1: Live Webcam Selfie Capture Viewfinder */}
      {cameraModalOpen && (
        <div className="portal-modal fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div role="dialog" aria-modal="true" aria-label="Attendance selfie capture" className="bg-[#111827] border border-[#1F293D] rounded-3xl p-4 sm:p-6 lg:p-8 max-w-md w-full my-auto shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[#1F293D] pb-3">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Camera className="w-5 h-5 text-purple-400" />
                <h3 className="text-sm sm:text-base font-bold text-white">Attendance Selfie Capture</h3>
              </div>
              <button
                onClick={closeSelfieModal}
                aria-label="Close selfie capture"
                disabled={actionLoading}
                className="shrink-0 p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-[#161F30] transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              To prevent proxy check-ins, please take a live webcam snapshot for an administrator to review.
            </p>
            {msg?.type === 'error' && <p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-xs text-rose-300">{msg.text}</p>}

            {/* Video Viewfinder / Captured Photo Preview */}
            <div className="relative aspect-[4/3] bg-[#0B0F19] rounded-2xl overflow-hidden border-2 border-[#1F293D] flex items-center justify-center">
              {!capturedPhoto ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover transform -scale-x-100"
                  />
                  {cameraStarting && (
                    <div className="absolute inset-0 bg-[#0B0F19]/80 flex flex-col items-center justify-center text-xs text-gray-300 gap-2">
                      <Camera className="w-6 h-6 animate-pulse text-[#5470F4]" />
                      <span>Opening camera stream...</span>
                    </div>
                  )}
                  {cameraError && (
                    <div className="absolute inset-0 bg-[#0B0F19]/95 p-4 flex flex-col items-center justify-center text-center space-y-3">
                      <AlertTriangle className="w-8 h-8 text-amber-400" />
                      <p className="text-xs text-amber-300">{cameraError}</p>
                      <button
                        onClick={startCamera}
                        className="px-3 py-1.5 rounded-xl bg-[#161F30] hover:bg-[#1E293D] text-[#5CC5FA] text-xs font-bold border border-[#1F293D] transition-all shadow"
                      >
                        Retry Camera
                      </button>
                      {isCEO && (
                        <button
                          onClick={handleSimulateSelfie}
                          className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow"
                        >
                          Generate Test Snapshot (CEO)
                        </button>
                      )}
                    </div>
                  )}
                  {/* Viewfinder Target Graphic */}
                  <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-white/20 rounded-2xl m-4 flex items-center justify-center">
                    <span className="text-[10px] font-mono text-white/40 bg-black/40 px-2 py-0.5 rounded-full">
                      Align Face in Frame
                    </span>
                  </div>
                </>
              ) : (
                <div className="relative w-full h-full">
                  <img
                    src={capturedPhoto}
                    alt="Captured selfie"
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute top-3 left-3 bg-emerald-500/90 text-white text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 shadow">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Snapshot Ready</span>
                  </span>
                </div>
              )}
            </div>

            {/* Device Info Badge */}
            <div className="p-3 rounded-xl bg-[#161F30] border border-[#1F293D] flex items-center justify-between text-xs text-gray-300">
              <span className="flex items-center gap-1.5">
                <Laptop className="w-3.5 h-3.5 text-[#5CC5FA]" />
                <span>Device Signature:</span>
              </span>
              <span className="font-mono text-white font-bold">{deviceId ? deviceId.substring(0, 14) + '...' : 'Registering...'}</span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              {!capturedPhoto ? (
                <>
                  <button
                    onClick={handleTakeSnapshot}
                    disabled={cameraStarting || !!cameraError || !cameraStream}
                    className="flex-1 py-3 rounded-xl text-xs font-bold gradient-btn text-white shadow-lg shadow-[#5470F4]/30 flex items-center justify-center gap-2 hover:scale-[1.01] transition-all disabled:opacity-50"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Take Snapshot</span>
                  </button>
                  {isCEO && (
                    <button
                      onClick={handleSimulateSelfie}
                      className="px-3 py-3 rounded-xl text-xs font-semibold bg-[#161F30] hover:bg-[#1E293D] text-amber-300 border border-amber-500/30 transition-all"
                      title="Simulate Photo for Testing (CEO Only)"
                    >
                      Simulate
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    onClick={startCamera}
                    className="px-4 py-3 rounded-xl text-xs font-semibold bg-[#161F30] hover:bg-[#1E293D] text-gray-300 border border-[#1F293D] flex items-center gap-1.5 transition-all"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Retake</span>
                  </button>
                  <button
                    onClick={() => executeCheckIn(capturedPhoto)}
                    disabled={actionLoading}
                    className="flex-1 py-3 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{actionLoading ? 'Recording Clock-In...' : 'Confirm & Clock In'}</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Photo & Anti-Proxy Audit Inspector for CEO */}
      {inspectModal?.isOpen && (
        <div className="portal-modal fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div role="dialog" aria-modal="true" aria-label="Attendance verification audit" className="bg-[#111827] border border-[#1F293D] rounded-3xl p-4 sm:p-6 lg:p-8 max-w-lg w-full my-auto shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[#1F293D] pb-3">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#5470F4]" />
                <h3 className="text-sm sm:text-base font-bold text-white">Attendance Verification Audit</h3>
              </div>
              <button
                onClick={() => setInspectModal(null)}
                aria-label="Close attendance audit"
                className="shrink-0 p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-[#161F30] transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl overflow-hidden border border-[#1F293D] max-h-72 flex items-center justify-center bg-black">
                <img
                  src={inspectModal.photo}
                  alt="Attendance snapshot"
                  className="w-full h-full object-contain max-h-72"
                />
              </div>

              <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-[#161F30] border border-[#1F293D]">
                  <span className="text-gray-400 text-[10px] block">Employee</span>
                  <span className="font-bold text-white text-sm">{inspectModal.userName}</span>
                  <span className="text-[10px] text-gray-400 block">{inspectModal.department}</span>
                </div>

                <div className="p-3 rounded-xl bg-[#161F30] border border-[#1F293D]">
                  <span className="text-gray-400 text-[10px] block">Clock-In Time</span>
                  <span className="font-bold text-white text-sm">{inspectModal.checkInTime}</span>
                  <span className="text-[10px] text-emerald-400 block">{inspectModal.distance} from office</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#161F30] border border-[#1F293D] space-y-1.5 text-xs">
                <span className="text-gray-400 text-[10px] uppercase font-bold block">Physical Device Signature</span>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between font-mono text-[11px] text-gray-300">
                  <span className="shrink-0">Device ID:</span>
                  <span className="text-white font-bold">{inspectModal.deviceInfo?.deviceId || 'No device recorded'}</span>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between font-mono text-[11px] text-gray-300">
                  <span className="shrink-0">Browser / OS:</span>
                  <span className="text-white">{inspectModal.deviceInfo?.browser || 'Chrome/Browser'}</span>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setInspectModal(null)}
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-[#1F293D] hover:bg-[#5470F4] text-white transition-all"
              >
                Close Audit Inspection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
