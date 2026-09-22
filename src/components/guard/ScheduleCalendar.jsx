import React from 'react';
import { Calendar, Clock, MapPin, AlertCircle, Bell } from 'lucide-react';
import { useSecurity } from '../../context/SecurityContext';
import { getCurrentWeekDates } from '../../data/mockData';

export const ScheduleCalendar = () => {
  const { currentUser, sites, rosters, triggerShiftEndReminder, addNotification } = useSecurity();
  const currentRoster = rosters[0];
  const weekDays = getCurrentWeekDates();
  const assignedSite = sites.find(s => s.id === currentUser.assignedSiteId) || sites[0];

  const guardShifts = currentRoster?.shifts?.filter(s => s.guardId === currentUser.id) || [];

  const handleSimulateTomorrowReminder = () => {
    addNotification({
      userId: currentUser.id,
      title: 'Shift Reminder for Tomorrow',
      message: `You're on shift tomorrow, 18:00–06:00 at ${assignedSite?.name}. Have a restful preparation.`,
      type: 'reminder',
      actionTab: 'calendar'
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#fff' }}>Weekly Roster</h2>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Week {currentRoster?.weekNumber || '38'} &bull; Published by Manager
          </div>
        </div>
        <button
          onClick={handleSimulateTomorrowReminder}
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--accent-green)',
            padding: '5px 10px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
          title="Simulate push reminder sent the evening before next shift"
        >
          <Bell size={12} />
          <span>Evening Reminder</span>
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
        {weekDays.map(day => {
          const shift = guardShifts.find(s => s.dayName === day.dayName);
          const isWorking = shift && shift.status !== 'off';
          const shiftSite = sites.find(s => s.id === (shift?.siteId || currentUser.assignedSiteId));

          return (
            <div
              key={day.dayName}
              style={{
                background: day.isToday
                  ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(14, 22, 38, 0.95) 100%)'
                  : 'var(--bg-card)',
                border: day.isToday
                  ? '1px solid rgba(16, 185, 129, 0.4)'
                  : '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ textAlign: 'center', width: '40px' }}>
                  <div
                    style={{
                      fontSize: '12px',
                      fontWeight: '800',
                      color: day.isToday ? 'var(--accent-green)' : '#fff'
                    }}
                  >
                    {day.dayName}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    {day.displayDate}
                  </div>
                </div>

                <div style={{ borderLeft: '1px solid var(--border-subtle)', paddingLeft: '12px' }}>
                  {isWorking ? (
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={12} color="var(--accent-green)" />
                        <span className="mono">{shift.startTime} – {shift.endTime}</span>
                        {day.isToday && (
                          <span style={{ fontSize: '9px', background: 'var(--accent-green)', color: '#000', padding: '1px 5px', borderRadius: '3px', fontWeight: '800' }}>
                            TODAY
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                        <MapPin size={10} />
                        <span>{shiftSite?.name}</span>
                      </div>
                      {shift.isOverridden && (
                        <div style={{ fontSize: '10px', color: 'var(--accent-amber)', marginTop: '2px' }}>
                          ⚠️ Override: {shift.overrideReason}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Rest Day / Scheduled Off
                    </div>
                  )}
                </div>
              </div>

              {isWorking && (
                <div style={{ textAlign: 'right' }}>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: '700',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: 'rgba(16, 185, 129, 0.1)',
                      color: 'var(--accent-green)',
                      border: '1px solid rgba(16, 185, 129, 0.3)'
                    }}
                  >
                    CONFIRMED
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div
        style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 12px',
          fontSize: '11px',
          color: 'var(--text-muted)'
        }}
      >
        📌 <strong>Advance Notice Protocol:</strong> Weekly rosters are published every Sunday. You will receive an evening-before push notification prior to every scheduled shift.
      </div>
    </div>
  );
};
