import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, Switch
} from 'react-native';
import { useApp } from '../../context/AppContext';
import { Plus, Trash2, GripVertical, X, MapPin } from 'lucide-react-native';

export function ManagerCheckpointScreen() {
  const { currentUser, sites, checkpoints, saveCheckpoints } = useApp();

  const mgrSites = sites.filter(s => currentUser.siteIds?.includes(s.id));
  const [selectedSite, setSelectedSite] = useState(mgrSites[0]?.id || null);
  const [addModal, setAddModal]         = useState(false);
  const [newName, setNewName]           = useState('');
  const [newRequired, setNewRequired]   = useState(true);
  const [saving, setSaving]             = useState(false);

  const siteCheckpoints = checkpoints
    .filter(cp => cp.siteId === selectedSite)
    .sort((a, b) => a.order - b.order);

  const handleAdd = async () => {
    if (!newName.trim()) { Alert.alert('Name required'); return; }
    setSaving(true);
    const newCP = {
      id: `cp_${Date.now()}`,
      siteId: selectedSite,
      name: newName.trim(),
      order: siteCheckpoints.length + 1,
      required: newRequired,
    };
    await saveCheckpoints([...checkpoints, newCP]);
    setSaving(false);
    setAddModal(false);
    setNewName('');
    setNewRequired(true);
  };

  const handleDelete = (cpId) => {
    Alert.alert('Delete Checkpoint', 'Remove this checkpoint from the patrol route?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const updated = checkpoints
            .filter(cp => cp.id !== cpId)
            .map((cp, i) => cp.siteId === selectedSite ? { ...cp, order: i + 1 } : cp);
          await saveCheckpoints(updated);
        }
      }
    ]);
  };

  const toggleRequired = async (cpId) => {
    const updated = checkpoints.map(cp =>
      cp.id === cpId ? { ...cp, required: !cp.required } : cp
    );
    await saveCheckpoints(updated);
  };

  return (
    <View style={styles.root}>
      <Text style={styles.screenTitle}>Checkpoint Config</Text>

      {/* Site selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.siteScroll} contentContainerStyle={styles.siteScrollContent}>
        {mgrSites.map(site => (
          <TouchableOpacity
            key={site.id}
            style={[styles.siteTab, selectedSite === site.id && styles.siteTabActive]}
            onPress={() => setSelectedSite(site.id)}
          >
            <MapPin size={12} color={selectedSite === site.id ? '#10b981' : '#64748b'} />
            <Text style={[styles.siteTabTxt, selectedSite === site.id && styles.siteTabTxtActive]}>
              {site.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>{siteCheckpoints.length} checkpoint{siteCheckpoints.length !== 1 ? 's' : ''}</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setAddModal(true)}>
          <Plus color="#fff" size={16} />
          <Text style={styles.addBtnTxt}>Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {siteCheckpoints.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No checkpoints configured</Text>
            <Text style={styles.emptySub}>
              Add checkpoints for guards to photograph during patrols at this site.
            </Text>
          </View>
        )}

        {siteCheckpoints.map((cp, i) => (
          <View key={cp.id} style={styles.cpRow}>
            <View style={styles.orderBadge}>
              <Text style={styles.orderNum}>{i + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cpName}>{cp.name}</Text>
              <View style={styles.reqRow}>
                <Text style={styles.reqLabel}>Required photo</Text>
                <Switch
                  value={cp.required}
                  onValueChange={() => toggleRequired(cp.id)}
                  trackColor={{ true: '#10b981', false: '#334155' }}
                  thumbColor="#fff"
                  style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                />
              </View>
            </View>
            <TouchableOpacity onPress={() => handleDelete(cp.id)} style={styles.deleteBtn}>
              <Trash2 color="#ef4444" size={18} />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      {/* Add Checkpoint Modal */}
      <Modal visible={addModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Add Checkpoint</Text>
              <TouchableOpacity onPress={() => setAddModal(false)}>
                <X color="#64748b" size={20} />
              </TouchableOpacity>
            </View>
            <Text style={styles.siteName}>
              {sites.find(s => s.id === selectedSite)?.name}
            </Text>

            <Text style={styles.fieldLabel}>Checkpoint Name</Text>
            <TextInput
              style={styles.input}
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g. Main Gate, Rear Fence, Server Room..."
              placeholderTextColor="#475569"
              autoFocus
            />

            <View style={styles.reqToggleRow}>
              <Text style={styles.fieldLabel}>Require Photo</Text>
              <Switch
                value={newRequired}
                onValueChange={setNewRequired}
                trackColor={{ true: '#10b981', false: '#334155' }}
                thumbColor="#fff"
              />
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.disabled]}
              onPress={handleAdd}
              disabled={saving}
            >
              <Text style={styles.saveBtnTxt}>{saving ? 'Adding...' : 'Add Checkpoint'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: '#090d16', padding: 20, paddingTop: 60 },
  screenTitle:  { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 16 },
  siteScroll:   { maxHeight: 50, marginBottom: 16 },
  siteScrollContent:{ gap: 8, paddingRight: 8 },
  siteTab:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0f172a', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#1e293b' },
  siteTabActive:{ borderColor: '#10b981' },
  siteTabTxt:   { color: '#64748b', fontSize: 12, fontWeight: '600' },
  siteTabTxtActive:{ color: '#10b981' },
  listHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  listTitle:    { color: '#64748b', fontSize: 13, fontWeight: '600' },
  addBtn:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#10b981', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnTxt:    { color: '#fff', fontSize: 13, fontWeight: '700' },
  emptyState:   { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyTitle:   { color: '#fff', fontSize: 16, fontWeight: '700' },
  emptySub:     { color: '#475569', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  cpRow:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#1e293b', gap: 12 },
  orderBadge:   { width: 28, height: 28, borderRadius: 14, backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center' },
  orderNum:     { color: '#94a3b8', fontSize: 12, fontWeight: '700' },
  cpName:       { color: '#fff', fontSize: 14, fontWeight: '700' },
  reqRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  reqLabel:     { color: '#64748b', fontSize: 11 },
  deleteBtn:    { padding: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', paddingHorizontal: 20 },
  modalCard:    { backgroundColor: '#0f172a', borderRadius: 20, padding: 24, borderWidth: 1, borderColor: '#1e293b' },
  modalHead:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  modalTitle:   { color: '#fff', fontSize: 18, fontWeight: '800' },
  siteName:     { color: '#64748b', fontSize: 12, marginBottom: 16 },
  fieldLabel:   { color: '#94a3b8', fontSize: 12, fontWeight: '600', marginBottom: 8 },
  input:        { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155', borderRadius: 10, padding: 12, color: '#fff', fontSize: 14, marginBottom: 16 },
  reqToggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  saveBtn:      { backgroundColor: '#10b981', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  saveBtnTxt:   { color: '#fff', fontSize: 15, fontWeight: '800' },
  disabled:     { opacity: 0.6 },
});
