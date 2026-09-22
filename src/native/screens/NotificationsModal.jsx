import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView
} from 'react-native';
import { Bell, X, ShieldAlert, Clock, Calendar, Info, CheckCheck } from 'lucide-react-native';
import { useSecurity } from '../../context/SecurityContext';

export const NotificationsModal = ({ visible, onClose }) => {
  const { notifications, setNotifications } = useSecurity();

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const getIcon = (type) => {
    switch (type) {
      case 'emergency':
        return <ShieldAlert color="#ef4444" size={18} />;
      case 'shift':
        return <Clock color="#38bdf8" size={18} />;
      case 'check_call':
        return <Clock color="#10b981" size={18} />;
      case 'roster':
        return <Calendar color="#f59e0b" size={18} />;
      default:
        return <Info color="#94a3b8" size={18} />;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Bell color="#38bdf8" size={20} />
              <Text style={styles.headerTitle}>Operations Inbox</Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity onPress={handleMarkAllRead} style={styles.markReadButton}>
                <CheckCheck color="#38bdf8" size={16} />
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X color="#94a3b8" size={20} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {notifications.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>No notifications yet.</Text>
              </View>
            ) : (
              notifications.map((n) => (
                <View
                  key={n.id}
                  style={[styles.notifCard, !n.read && styles.notifCardUnread]}
                >
                  <View style={styles.iconWrap}>{getIcon(n.type)}</View>
                  <View style={styles.notifCol}>
                    <Text style={styles.notifTitle}>{n.title}</Text>
                    <Text style={styles.notifMsg}>{n.message}</Text>
                    <Text style={styles.notifTime}>
                      {new Date(n.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end'
  },
  card: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    maxHeight: '85%',
    padding: 20
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc'
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  markReadButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#1e293b'
  },
  closeButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#1e293b'
  },
  body: {
    marginBottom: 10
  },
  emptyWrap: {
    paddingVertical: 40,
    alignItems: 'center'
  },
  emptyText: {
    color: '#64748b',
    fontSize: 14
  },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155'
  },
  notifCardUnread: {
    borderColor: '#0284c7',
    backgroundColor: 'rgba(2, 132, 199, 0.08)'
  },
  iconWrap: {
    marginTop: 2
  },
  notifCol: {
    flex: 1
  },
  notifTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 2
  },
  notifMsg: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 16
  },
  notifTime: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 4
  }
});
