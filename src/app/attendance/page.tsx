'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiGet, apiPost } from '../../lib/api';
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
} from 'lucide-react';

export default function AttendancePage() {
  const { user, hasRole } = useAuth();
  const isCEO = user?.role === 'CEO' || hasRole('CEO');


  const [todayAttendance, setTodayAttendance] = useState<any>(null);
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
  const [roster, setRoster] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'self' | 'roster'>('self');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

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
  const [msg, setMsg] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

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
      setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Initialize or retrieve persistent Device ID
  useEffect(() => {
    if (typeof window !== 'undefined') {
      let storedId = localStorage.getItem('neximet_device_id');
      if (!storedId) {
        storedId = 'dev_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
        localStorage.setItem('neximet_device_id', storedId);
      }
      setDeviceId(storedId);
    }
  }, []);

  // Haversine distance calculator
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  };

  // Obtain real device GPS coordinates automatically
  const acquireLocation = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setLocError('Geolocation is not supported by your browser.');
      return;
    }
    setLocLoading(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        setDeviceCoords(coords);
        setLocLoading(false);
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
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
    );
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
    }
  }, [deviceCoords, officeLocation, simulatedLocation, isCEO]);

  const fetchAttendanceData = async () => {
    setLoading(true);
    try {
      const todayRes = await apiGet('/attendance/today');
      if (todayRes.success) {
        setTodayAttendance(todayRes.attendance);
        if (todayRes.officeLocation) {
          setOfficeLocation(todayRes.officeLocation);
        }
        if (todayRes.antiProxySettings) {
          setAntiProxySettings(todayRes.antiProxySettings);
        }
      }

      const histRes = await apiGet('/attendance/history');
      if (histRes.success) {
        setHistory(histRes.records);
      }

      if (hasRole('CEO', 'Super Admin')) {
        const rosterRes = await apiGet('/attendance/roster');
        if (rosterRes.success) {
          setRoster(rosterRes.roster);
        }
      }
    } catch (err) {
      console.error('Attendance fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendanceData();
    acquireLocation();
  }, [user]);

  // Webcam Stream Management
  const startCamera = async () => {
    setCameraError(null);
    setCameraStarting(true);
    setCapturedPhoto(null);
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
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      console.warn('Camera stream error:', err);
      setCameraError(
        err.message || 'Could not access webcam camera. Please check camera permissions in your browser.'
      );
    } finally {
      setCameraStarting(false);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
  };

  // Open camera modal and initialize stream
  const openSelfieModal = () => {
    setCameraModalOpen(true);
    setCapturedPhoto(null);
    startCamera();
  };

  const closeSelfieModal = () => {
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
      const width = video.videoWidth || 360;
      const height = video.videoHeight || 270;

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Mirror if user facing
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
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
        ctx.fillText('✓ LIVE SELFIE VERIFIED', 180, 195);

        ctx.fillStyle = '#94A3B8';
        ctx.font = '11px monospace';
        ctx.fillText(new Date().toLocaleTimeString() + ' • Verified Office Device', 180, 220);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedPhoto(dataUrl);
        stopCamera();
      }
    }
  };

  // Trigger check-in initiation
  const initiateCheckIn = () => {
    if (antiProxySettings.requireSelfieVerification) {
      openSelfieModal();
    } else {
      executeCheckIn(null);
    }
  };

  // Submit Check-In Payload
  const executeCheckIn = async (photoPayload: string | null) => {
    setActionLoading(true);
    setMsg(null);
    let customTime: string | undefined = undefined;

    // CEO-only time simulation
    if (isCEO) {
      const today = new Date();
      if (simulatedHour === 'on_time') {
        today.setHours(8, 50, 0, 0);
        customTime = today.toISOString();
      } else if (simulatedHour === 'grace') {
        today.setHours(9, 10, 0, 0);
        customTime = today.toISOString();
      } else if (simulatedHour === 'late_35') {
        today.setHours(9, 35, 0, 0);
        customTime = today.toISOString();
      } else if (simulatedHour === 'half_day') {
        today.setHours(10, 15, 0, 0);
        customTime = today.toISOString();
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
    } else if (deviceCoords) {
      lat = deviceCoords.latitude;
      lng = deviceCoords.longitude;
    }

    // Determine device ID
    const activeDeviceId = (isCEO && simulatedDevice === 'secondary')
      ? 'dev_secondary_device_99'
      : deviceId;

    try {
      const res = await apiPost('/attendance/check-in', {
        customTime,
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
      setActionLoading(false);
    }
  };

  // Handle Check-Out
  const handleCheckOut = async () => {
    setActionLoading(true);
    setMsg(null);
    try {
      const res = await apiPost('/attendance/check-out');
      if (res.success) {
        setMsg({ type: 'success', text: res.message || 'Check-out recorded successfully' });
        fetchAttendanceData();
      } else {
        setMsg({ type: 'error', text: res.message || 'Check-out failed' });
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: err?.message || 'Check-out error occurred' });
    } finally {
      setActionLoading(false);
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
            Live GPS geofencing, single-device lock, anti-proxy facial verification, and automated deduction tracking.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <div className="bg-[#111827] border border-[#1F293D] px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-2xl flex items-center gap-2.5 shadow-sm">
            <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-purple-400 animate-pulse shrink-0" />
            <div className="text-xs">
              <span className="text-gray-400 block text-[9px] sm:text-[10px]">Anti-Proxy Shield</span>
              <span className="text-white font-bold text-[11px] sm:text-xs">1-Device Lock + Live Selfie</span>
            </div>
          </div>

          <div className="bg-[#111827] border border-[#1F293D] px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-2xl flex items-center gap-2.5 shadow-sm">
            <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <div className="text-xs">
              <span className="text-gray-400 block text-[9px] sm:text-[10px]">Active Shift</span>
              <span className="text-white font-bold text-[11px] sm:text-xs">09:00 AM - 06:00 PM (15m Grace)</span>
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
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">Today's State</span>
                  <div className="flex items-center gap-2 mt-1">
                    {todayAttendance?.checkIn ? (
                      <span className={`text-xs sm:text-sm font-bold px-3 py-1 rounded-xl flex items-center gap-1.5 ${todayAttendance.status === 'present'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : todayAttendance.status === 'half_day'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                        {todayAttendance.isLate ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        <span className="capitalize">{todayAttendance.status.replace('_', ' ')}</span>
                        {todayAttendance.isLate && ` (${todayAttendance.minutesLate}m late)`}
                      </span>
                    ) : (
                      <span className="text-xs font-bold px-3 py-1 rounded-xl bg-gray-500/20 text-gray-400 border border-gray-500/30">
                        Not Checked In Yet
                      </span>
                    )}
                  </div>
                </div>

                {/* Selfie Thumbnail if checked in with photo */}
                {todayAttendance?.photo && (
                  <div className="relative group cursor-pointer" onClick={() => setInspectModal({
                    isOpen: true,
                    photo: todayAttendance.photo,
                    userName: user?.name || 'You',
                    department: user?.department || '',
                    checkInTime: new Date(todayAttendance.checkIn).toLocaleTimeString(),
                    distance: todayAttendance.location?.distanceMeters !== null ? `${todayAttendance.location?.distanceMeters}m` : 'Verified',
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
                      ? new Date(todayAttendance.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '--:--'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#161F30] border border-[#1F293D]">
                  <span className="text-gray-400 text-[10px] block font-semibold">Check-Out</span>
                  <span className="font-bold text-white text-sm">
                    {todayAttendance?.checkOut
                      ? new Date(todayAttendance.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '--:--'}
                  </span>
                </div>
              </div>

              {/* Deduction Indicator for Today */}
              {todayAttendance && todayAttendance.deductionAmount > 0 && (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-rose-400 flex items-center gap-1.5">
                      <Coins className="w-3.5 h-3.5" />
                      <span>Penalty Applied</span>
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
                      <span>Office GPS & Device Verified</span>
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
                    <LocateFixed className="w-3.5 h-3.5 animate-spin text-[#5CC5FA]" />
                    <span>Automatically acquiring live GPS coordinates...</span>
                  </div>
                )}
              </div>

              {/* Automatic Device Identification & Lock */}
              <div className="p-3 rounded-xl bg-[#0B0F19] border border-[#1F293D] space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-gray-300">
                  <span className="flex items-center gap-1.5 font-bold">
                    <Laptop className="w-3.5 h-3.5 text-[#5CC5FA]" />
                    <span>Hardware Signature</span>
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20 flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" />
                    <span>1-Device Locked</span>
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
                          <option value="on_time">Simulate On-Time Arrival (08:50 AM)</option>
                          <option value="grace">Simulate Grace Window (09:10 AM - 10m late)</option>
                          <option value="late_35">Simulate Late Arrival (09:35 AM - 35m late)</option>
                          <option value="half_day">Simulate Half-Day Penalty (10:15 AM - 75m late)</option>
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
                {!todayAttendance?.checkIn ? (
                  <button
                    onClick={initiateCheckIn}
                    disabled={actionLoading}
                    className="w-full py-3 sm:py-3.5 rounded-xl text-xs sm:text-sm font-bold gradient-btn text-white shadow-lg shadow-[#5470F4]/30 flex items-center justify-center gap-2 hover:scale-[1.01] transition-all disabled:opacity-50"
                  >
                    <Camera className="w-4 h-4" />
                    <span>{actionLoading ? 'Verifying & Clocking In...' : 'Verify Selfie & Clock-In'}</span>
                  </button>
                ) : !todayAttendance?.checkOut ? (
                  <button
                    onClick={handleCheckOut}
                    disabled={actionLoading}
                    className="w-full py-3 sm:py-3.5 rounded-xl text-xs sm:text-sm font-bold bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    <Clock className="w-4 h-4" />
                    <span>{actionLoading ? 'Recording...' : 'Mark Check-Out Now'}</span>
                  </button>
                ) : (
                  <div className="p-3 text-center bg-[#0B0F19] rounded-xl border border-[#1F293D] text-xs font-semibold text-emerald-400">
                    ✓ Completed shifts for today ({todayAttendance.totalWorkHours} hrs recorded)
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
                {(user?.leaveBalances?.casual || 0) + (user?.leaveBalances?.sick || 0) + (user?.leaveBalances?.annual || 0)}
              </span>
              <span className="text-xs text-gray-400 block mt-0.5">Total Days Remaining</span>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#161F30] border border-[#1F293D] text-xs">
                <span className="text-gray-300 font-medium">Casual Leaves</span>
                <span className="font-bold text-white font-mono">{user?.leaveBalances?.casual || 0} days</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-[#161F30] border border-[#1F293D] text-xs">
                <span className="text-gray-300 font-medium">Medical / Sick Leaves</span>
                <span className="font-bold text-white font-mono">{user?.leaveBalances?.sick || 0} days</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-[#161F30] border border-[#1F293D] text-xs">
                <span className="text-gray-300 font-medium">Annual Paid Vacations</span>
                <span className="font-bold text-white font-mono">{user?.leaveBalances?.annual || 0} days</span>
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
                Today's Company Roster ({roster.length} Staff)
              </button>
            )}
          </div>
        </div>

        {/* Tab 1: Personal History Table */}
        {activeTab === 'self' ? (
          <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
            <table className="w-full text-left text-xs min-w-[720px]">
              <thead className="text-gray-400 uppercase tracking-wider font-bold border-b border-[#1F293D] bg-[#0B0F19]">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Selfie Snapshot</th>
                  <th className="py-3 px-4">Check-In</th>
                  <th className="py-3 px-4">Check-Out</th>
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
                        {record.photo ? (
                          <img
                            src={record.photo}
                            alt="Selfie"
                            onClick={() => setInspectModal({
                              isOpen: true,
                              photo: record.photo,
                              userName: user?.name || 'You',
                              department: user?.department || '',
                              checkInTime: record.checkIn ? new Date(record.checkIn).toLocaleTimeString() : '',
                              distance: record.location?.distanceMeters !== null ? `${record.location?.distanceMeters}m` : 'Verified',
                              deviceInfo: record.deviceInfo,
                            })}
                            className="w-9 h-9 rounded-xl object-cover border border-emerald-400/40 cursor-pointer hover:scale-110 transition-transform shadow"
                          />
                        ) : (
                          <span className="text-gray-500 font-mono text-[10px]">--</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-white">
                        {record.checkIn ? new Date(record.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                      </td>
                      <td className="py-3.5 px-4 text-white">
                        {record.checkOut ? new Date(record.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold capitalize ${record.status === 'present'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : record.status === 'half_day'
                              ? 'bg-rose-500/20 text-rose-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}>
                          {record.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-gray-300">
                        {record.minutesLate > 0 ? (
                          <span className="text-amber-400 font-bold">{record.minutesLate} mins late</span>
                        ) : (
                          <span className="text-emerald-400">On-Time</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {record.deductionAmount > 0 ? (
                          <span className="text-rose-400 font-bold font-mono">-PKR {record.deductionAmount}</span>
                        ) : (
                          <span className="text-gray-500">PKR 0</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-gray-400 max-w-xs truncate">
                        {record.deductionReason || record.notes || 'Normal attendance'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-500">
                      No attendance history recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
                      {item.photo ? (
                        <div
                          className="relative group inline-block cursor-pointer"
                          onClick={() => setInspectModal({
                            isOpen: true,
                            photo: item.photo,
                            userName: item.user?.name,
                            department: item.user?.department,
                            checkInTime: item.checkIn ? new Date(item.checkIn).toLocaleTimeString() : '',
                            distance: item.location?.distanceMeters !== null ? `${item.location?.distanceMeters}m` : 'Verified',
                            deviceInfo: item.deviceInfo,
                          })}
                        >
                          <img
                            src={item.photo}
                            alt="Check-in snapshot"
                            className="w-9 h-9 rounded-xl object-cover border border-purple-400/40 group-hover:border-purple-400 transition-all shadow group-hover:scale-110"
                          />
                          <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Eye className="w-3 h-3 text-white" />
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-500 font-mono text-[10px]">No Photo</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-gray-300">{item.user.department}</td>
                    <td className="py-3.5 px-4 font-mono text-white">
                      {item.checkIn ? new Date(item.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Not yet'}
                    </td>
                    <td className="py-3.5 px-4">
                      {item.checkedIn ? (
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            <span>1-Device Locked</span>
                          </span>
                          {item.location?.distanceMeters !== null && (
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
                              : 'bg-gray-500/20 text-gray-400'
                        }`}>
                        {item.status.replace('_', ' ')}
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: Live Webcam Selfie Capture Viewfinder */}
      {cameraModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-[#111827] border border-[#1F293D] rounded-3xl p-4 sm:p-6 lg:p-8 max-w-md w-full my-auto shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[#1F293D] pb-3">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-purple-400" />
                <h3 className="text-sm sm:text-base font-bold text-white">Live Identity Verification</h3>
              </div>
              <button
                onClick={closeSelfieModal}
                className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-[#161F30] transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              To prevent proxy check-ins, please take a live webcam snapshot to verify your physical presence.
            </p>

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
                          Generate Verified Snapshot (CEO Test)
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
                    disabled={cameraStarting || !!cameraError}
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-[#111827] border border-[#1F293D] rounded-3xl p-4 sm:p-6 lg:p-8 max-w-lg w-full my-auto shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[#1F293D] pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#5470F4]" />
                <h3 className="text-sm sm:text-base font-bold text-white">Attendance Verification Audit</h3>
              </div>
              <button
                onClick={() => setInspectModal(null)}
                className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-[#161F30] transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl overflow-hidden border border-[#1F293D] max-h-72 flex items-center justify-center bg-black">
                <img
                  src={inspectModal.photo}
                  alt="Verified Snapshot"
                  className="w-full h-full object-contain max-h-72"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
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
                <div className="flex items-center justify-between font-mono text-[11px] text-gray-300">
                  <span>Device ID:</span>
                  <span className="text-white font-bold">{inspectModal.deviceInfo?.deviceId || 'Verified Device'}</span>
                </div>
                <div className="flex items-center justify-between font-mono text-[11px] text-gray-300">
                  <span>Browser / OS:</span>
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
