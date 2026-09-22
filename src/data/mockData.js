// Realistic Mock Data for Observant Security Operations System

export const INITIAL_SITES = [
  {
    id: 'site-1',
    name: 'Apex Tower - Financial Center',
    address: '100 Bishopsgate, City Center',
    zone: 'Zone Alpha',
    requiredCheckpoints: [
      { id: 'cp-1-1', name: 'Main Lobby & Turnstiles', description: 'Inspect visitor badges & speed gates', requiredPhoto: true },
      { id: 'cp-1-2', name: 'Loading Bay & Service Lift', description: 'Check bay roller doors & padlock seal', requiredPhoto: true },
      { id: 'cp-1-3', name: 'Basement Parking B2', description: 'Inspect fire exits and barrier gates', requiredPhoto: true },
      { id: 'cp-1-4', name: 'Server Room Corridor 4F', description: 'Verify biometric access log and HVAC sound', requiredPhoto: true },
      { id: 'cp-1-5', name: 'Rooftop Helipad & Plant Room', description: 'Inspect perimeter safety rail and plant locks', requiredPhoto: true }
    ]
  },
  {
    id: 'site-2',
    name: 'Highland Logistics Hub',
    address: '44 Freight Way, Industrial Estate',
    zone: 'Zone Bravo',
    requiredCheckpoints: [
      { id: 'cp-2-1', name: 'North Security Gate & Boom', description: 'Inspect ANPR cameras and vehicle barriers', requiredPhoto: true },
      { id: 'cp-2-2', name: 'Container Yard Bay 12-18', description: 'Check refrigerated container seals', requiredPhoto: true },
      { id: 'cp-2-3', name: 'Distribution Center Bay 4', description: 'Inspect dock levelers & warehouse doors', requiredPhoto: true },
      { id: 'cp-2-4', name: 'Perimeter Sensor Post 9', description: 'Verify electric fence tension & warning lamps', requiredPhoto: true },
      { id: 'cp-2-5', name: 'Fleet Overnight Staging', description: 'Check parked tractor units and fuel tanks', requiredPhoto: true }
    ]
  },
  {
    id: 'site-3',
    name: 'Marina Gateway Maritime Dock',
    address: 'Pier 7, Commercial Docks',
    zone: 'Zone Delta',
    requiredCheckpoints: [
      { id: 'cp-3-1', name: 'Harbor Gatehouse', description: 'Inspect terminal entry gate and visitor logs', requiredPhoto: true },
      { id: 'cp-3-2', name: 'Dry Dock Perimeter South', description: 'Verify mooring lines and safety fencing', requiredPhoto: true },
      { id: 'cp-3-3', name: 'Fuel & Hazardous Tank Farm', description: 'Inspect emergency cutoff valve & bund walls', requiredPhoto: true },
      { id: 'cp-3-4', name: 'Customs Bonded Warehouse', description: 'Inspect tamper-evident seal on main shutter', requiredPhoto: true }
    ]
  }
];

export const INITIAL_USERS = [
  {
    id: 'guard-1',
    name: 'Ahmad Khan',
    role: 'guard',
    badgeNumber: 'SEC-8042',
    phone: '+44 7700 900142',
    assignedSiteId: 'site-1',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    status: 'Booked On',
    experienceYears: 4
  },
  {
    id: 'guard-2',
    name: 'Marcus Vance',
    role: 'guard',
    badgeNumber: 'SEC-7419',
    phone: '+44 7700 900781',
    assignedSiteId: 'site-2',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    status: 'Off Duty',
    experienceYears: 6
  },
  {
    id: 'guard-3',
    name: 'David Chen',
    role: 'guard',
    badgeNumber: 'SEC-9104',
    phone: '+44 7700 900355',
    assignedSiteId: 'site-3',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
    status: 'Off Duty',
    experienceYears: 2
  },
  {
    id: 'mgr-1',
    name: 'Elena Rostova',
    role: 'manager',
    badgeNumber: 'MGR-1002',
    phone: '+44 7700 900999',
    assignedSiteIds: ['site-1', 'site-2', 'site-3'],
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    status: 'Active Command',
    department: 'Regional Security Operations'
  }
];

// Helper to get dates for current week (Monday to Sunday)
export const getCurrentWeekDates = () => {
  const now = new Date();
  const day = now.getDay();
  // Distance to Monday (if Sun (0), treat as 7th day)
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days.map((dayName, index) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + index);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    return {
      dayName,
      dateStr,
      displayDate: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      isToday: dateStr === new Date().toISOString().split('T')[0]
    };
  });
};

export const INITIAL_TEMPLATES = [
  {
    id: 'tpl-1',
    name: "Ahmad's Usual Night Week",
    description: 'Mon, Tue, Thu, Fri, Sat — 18:00 to 06:00 (Apex Tower)',
    guardId: 'guard-1',
    siteId: 'site-1',
    schedule: {
      Mon: { active: true, start: '18:00', end: '06:00' },
      Tue: { active: true, start: '18:00', end: '06:00' },
      Wed: { active: false, start: '18:00', end: '06:00' },
      Thu: { active: true, start: '18:00', end: '06:00' },
      Fri: { active: true, start: '18:00', end: '06:00' },
      Sat: { active: true, start: '18:00', end: '06:00' },
      Sun: { active: false, start: '18:00', end: '06:00' }
    }
  },
  {
    id: 'tpl-2',
    name: "Marcus's Day Logistics Roster",
    description: 'Mon to Fri — 07:00 to 19:00 (Highland Hub)',
    guardId: 'guard-2',
    siteId: 'site-2',
    schedule: {
      Mon: { active: true, start: '07:00', end: '19:00' },
      Tue: { active: true, start: '07:00', end: '19:00' },
      Wed: { active: true, start: '07:00', end: '19:00' },
      Thu: { active: true, start: '07:00', end: '19:00' },
      Fri: { active: true, start: '07:00', end: '19:00' },
      Sat: { active: false, start: '07:00', end: '19:00' },
      Sun: { active: false, start: '07:00', end: '19:00' }
    }
  },
  {
    id: 'tpl-3',
    name: 'Weekend High-Alert Coverage',
    description: 'Sat & Sun 24-hr double shift coverage',
    guardId: 'guard-3',
    siteId: 'site-3',
    schedule: {
      Mon: { active: false, start: '08:00', end: '20:00' },
      Tue: { active: false, start: '08:00', end: '20:00' },
      Wed: { active: false, start: '08:00', end: '20:00' },
      Thu: { active: false, start: '08:00', end: '20:00' },
      Fri: { active: false, start: '08:00', end: '20:00' },
      Sat: { active: true, start: '08:00', end: '20:00' },
      Sun: { active: true, start: '08:00', end: '20:00' }
    }
  }
];

export const INITIAL_ROSTERS = [
  {
    id: 'roster-w1',
    weekNumber: 38,
    weekStartDate: getCurrentWeekDates()[0].dateStr,
    published: true,
    publishedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    shifts: [
      // Ahmad Khan shifts
      { id: 'sh-1', guardId: 'guard-1', siteId: 'site-1', dayName: 'Mon', startTime: '18:00', endTime: '06:00', status: 'completed' },
      { id: 'sh-2', guardId: 'guard-1', siteId: 'site-1', dayName: 'Tue', startTime: '18:00', endTime: '06:00', status: 'active', isCurrent: true },
      { id: 'sh-3', guardId: 'guard-1', siteId: 'site-1', dayName: 'Wed', startTime: '18:00', endTime: '06:00', status: 'off' },
      { id: 'sh-4', guardId: 'guard-1', siteId: 'site-1', dayName: 'Thu', startTime: '18:00', endTime: '06:00', status: 'scheduled' },
      { id: 'sh-5', guardId: 'guard-1', siteId: 'site-1', dayName: 'Fri', startTime: '18:00', endTime: '06:00', status: 'scheduled', isOverridden: true, overrideReason: 'Shift swap with M. Vance' },
      { id: 'sh-6', guardId: 'guard-1', siteId: 'site-1', dayName: 'Sat', startTime: '18:00', endTime: '06:00', status: 'scheduled' },
      { id: 'sh-7', guardId: 'guard-1', siteId: 'site-1', dayName: 'Sun', startTime: '18:00', endTime: '06:00', status: 'off' },
      
      // Marcus Vance shifts
      { id: 'sh-8', guardId: 'guard-2', siteId: 'site-2', dayName: 'Mon', startTime: '07:00', endTime: '19:00', status: 'completed' },
      { id: 'sh-9', guardId: 'guard-2', siteId: 'site-2', dayName: 'Tue', startTime: '07:00', endTime: '19:00', status: 'completed' },
      { id: 'sh-10', guardId: 'guard-2', siteId: 'site-2', dayName: 'Wed', startTime: '07:00', endTime: '19:00', status: 'scheduled' },
      { id: 'sh-11', guardId: 'guard-2', siteId: 'site-2', dayName: 'Thu', startTime: '07:00', endTime: '19:00', status: 'scheduled' },
      { id: 'sh-12', guardId: 'guard-2', siteId: 'site-2', dayName: 'Fri', startTime: '07:00', endTime: '19:00', status: 'scheduled' },

      // David Chen shifts
      { id: 'sh-13', guardId: 'guard-3', siteId: 'site-3', dayName: 'Sat', startTime: '08:00', endTime: '20:00', status: 'scheduled' },
      { id: 'sh-14', guardId: 'guard-3', siteId: 'site-3', dayName: 'Sun', startTime: '08:00', endTime: '20:00', status: 'scheduled' }
    ]
  }
];

export const INITIAL_SHIFT_SESSIONS = [
  {
    id: 'session-live-1',
    guardId: 'guard-1',
    siteId: 'site-1',
    scheduledStartTime: '18:00',
    scheduledEndTime: '06:00',
    bookedOnAt: new Date(Date.now() - 3600000 * 3.5).toISOString(), // 3.5 hours ago
    punctualityStatus: 'On Time',
    punctualityMinutes: 2,
    bookedOffAt: null,
    isActive: true,
    gpsLocation: '51.5147° N, 0.0815° W (Apex Tower On-Site)'
  },
  {
    id: 'session-past-1',
    guardId: 'guard-2',
    siteId: 'site-2',
    scheduledStartTime: '07:00',
    scheduledEndTime: '19:00',
    bookedOnAt: new Date(Date.now() - 86400000 - 3600000 * 12).toISOString(),
    bookedOffAt: new Date(Date.now() - 86400000).toISOString(),
    punctualityStatus: 'Early',
    punctualityMinutes: 14,
    isActive: false,
    gpsLocation: '51.5200° N, 0.0900° W (Highland Hub)'
  }
];

export const INITIAL_CHECK_CALLS = [
  {
    id: 'cc-1',
    sessionId: 'session-live-1',
    guardId: 'guard-1',
    siteId: 'site-1',
    promptTime: new Date(Date.now() - 3600000 * 3).toISOString(),
    callType: 'hourly',
    status: 'completed',
    response: 'yes',
    responseTime: new Date(Date.now() - 3600000 * 3 + 45000).toISOString(),
    notes: 'All secure, perimeter lights operational.',
    managerAlerted: false
  },
  {
    id: 'cc-2',
    sessionId: 'session-live-1',
    guardId: 'guard-1',
    siteId: 'site-1',
    promptTime: new Date(Date.now() - 3600000 * 2).toISOString(),
    callType: 'hourly',
    status: 'completed',
    response: 'yes',
    responseTime: new Date(Date.now() - 3600000 * 2 + 72000).toISOString(),
    notes: 'No incidents observed. CCTV check clear.',
    managerAlerted: false
  },
  {
    id: 'cc-3',
    sessionId: 'session-live-1',
    guardId: 'guard-1',
    siteId: 'site-1',
    promptTime: new Date(Date.now() - 3600000 * 1).toISOString(),
    callType: 'random',
    status: 'issue_reported',
    response: 'no',
    responseTime: new Date(Date.now() - 3600000 * 1 + 60000).toISOString(),
    notes: 'Rear service shutter lock mechanism jammed. Maintenance team contacted.',
    managerAlerted: true
  }
];

export const INITIAL_PATROLS = [
  {
    id: 'patrol-1',
    sessionId: 'session-live-1',
    guardId: 'guard-1',
    siteId: 'site-1',
    startTime: new Date(Date.now() - 3600000 * 2.8).toISOString(),
    endTime: new Date(Date.now() - 3600000 * 2.4).toISOString(),
    status: 'completed',
    isAntiIdlePrompted: false,
    checkpointsTotal: 5,
    checkpointsCompleted: 5,
    captures: [
      {
        checkpointId: 'cp-1-1',
        name: 'Main Lobby & Turnstiles',
        timestamp: new Date(Date.now() - 3600000 * 2.75).toISOString(),
        photoUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&auto=format&fit=crop&q=80',
        verified: true
      },
      {
        checkpointId: 'cp-1-2',
        name: 'Loading Bay & Service Lift',
        timestamp: new Date(Date.now() - 3600000 * 2.7).toISOString(),
        photoUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&auto=format&fit=crop&q=80',
        verified: true
      },
      {
        checkpointId: 'cp-1-3',
        name: 'Basement Parking B2',
        timestamp: new Date(Date.now() - 3600000 * 2.6).toISOString(),
        photoUrl: 'https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=600&auto=format&fit=crop&q=80',
        verified: true
      },
      {
        checkpointId: 'cp-1-4',
        name: 'Server Room Corridor 4F',
        timestamp: new Date(Date.now() - 3600000 * 2.5).toISOString(),
        photoUrl: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&auto=format&fit=crop&q=80',
        verified: true
      },
      {
        checkpointId: 'cp-1-5',
        name: 'Rooftop Helipad & Plant Room',
        timestamp: new Date(Date.now() - 3600000 * 2.42).toISOString(),
        photoUrl: 'https://images.unsplash.com/photo-1508873696983-2df5703bc20d?w=600&auto=format&fit=crop&q=80',
        verified: true
      }
    ]
  }
];

export const INITIAL_ANTI_IDLE_LOGS = [
  {
    id: 'ail-1',
    guardId: 'guard-1',
    siteId: 'site-1',
    patrolSessionId: 'patrol-1',
    triggerTime: new Date(Date.now() - 3600000 * 2.9).toISOString(),
    promptType: 'Surprise Anti-Idle Patrol Alert',
    gapIntervalMinutes: 34,
    responded: true,
    responseLatencySeconds: 42,
    dynamicSlotShifted: true,
    newNextPatrolTime: new Date(Date.now() - 3600000 * 1.4).toISOString(),
    notes: 'Guard commenced surprise patrol within 42 seconds. Next scheduled patrol shifted forward 1 hour.'
  },
  {
    id: 'ail-2',
    guardId: 'guard-2',
    siteId: 'site-2',
    patrolSessionId: null,
    triggerTime: new Date(Date.now() - 86400000 - 3600000 * 4).toISOString(),
    promptType: 'Surprise Anti-Idle Patrol Alert',
    gapIntervalMinutes: 45,
    responded: false,
    responseLatencySeconds: null,
    dynamicSlotShifted: false,
    newNextPatrolTime: null,
    notes: 'Guard ignored surprise patrol prompt. Regular top-of-hour patrol schedule retained.'
  }
];

export const INITIAL_NOTIFICATIONS = [
  {
    id: 'notif-1',
    userId: 'guard-1',
    title: 'Weekly Schedule Published',
    message: 'Your schedule for this week is ready. Tap to view your assigned shifts at Apex Tower.',
    type: 'roster',
    timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
    read: true,
    actionTab: 'calendar'
  },
  {
    id: 'notif-2',
    userId: 'guard-1',
    title: 'Upcoming Shift Reminder',
    message: "You're on shift today, 18:00–06:00 at Apex Tower - Financial Center.",
    type: 'reminder',
    timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
    read: true,
    actionTab: 'shift'
  },
  {
    id: 'notif-3',
    userId: 'guard-1',
    title: 'Check Call Recorded',
    message: 'Okay thank you, your check call was recorded successfully.',
    type: 'check_call_ok',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    read: true,
    actionTab: 'check_call'
  }
];
