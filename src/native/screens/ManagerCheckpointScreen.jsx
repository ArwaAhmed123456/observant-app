import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, Switch,
} from 'react-native';
import { useApp } from '../../context/AppContext';
import { Plus, Trash2, X, MapPin, Navigation, Radio, ScanLine } from 'lucide-react-native';
import { AppHeader } from '../components/AppHeader';
import { EmptyState } from '../components/EmptyState';
import { P, SP, BR, FONT, SH_TOKENS, card, input, btnPrimary } from '../../ds';
import { readNfcTag } from '../../services/nfc';

export function ManagerCheckpointScreen() {
  const { currentUser, sites, checkpoints, saveCheckpoints } = useApp();

  const mgrSites       = sites.filter(s => currentUser.siteIds?.includes(s.id));
  const [selectedSite, setSelectedSite] = useState(mgrSites[0]?.id || null);
  const [addModal, setAddModal]         = useState(false);
  const [newName, setNewName]           = useState('');
  const [newRequired, setNewRequired]   = useState(true);
  const [newNfcRequired, setNewNfcRequired] = useState(false);
  const [newNfcTagId, setNewNfcTagId] = useState(null);
  const [pairingId, setPairingId] = useState(null);
  const [saving, setSaving]             = useState(false);

  const siteCheckpoints = checkpoints
    .filter(cp => cp.siteId === selectedSite)
    .sort((a, b) => a.order - b.order);

  const handleAdd = async () => {
    if (!newName.trim()) { Alert.alert('Name required'); return; }
    if (newNfcRequired && !newNfcTagId) { Alert.alert('Pair an NFC card', 'Scan the checkpoint card before making it required.'); return; }
    setSaving(true);
    const newCP = {
      id: `cp_${Date.now()}`,
      siteId: selectedSite,
      name: newName.trim(),
      order: siteCheckpoints.length + 1,
      required: newRequired,
      nfcRequired: newNfcRequired,
      nfcTagId: newNfcTagId,
    };
    await saveCheckpoints([...checkpoints, newCP]);
    setSaving(false);
    setAddModal(false);
    setNewName('');
    setNewRequired(true);
    setNewNfcRequired(false);
    setNewNfcTagId(null);
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
        },
      },
    ]);
  };

  const toggleRequired = async (cpId) => {
    const updated = checkpoints.map(cp => cp.id === cpId ? { ...cp, required: !cp.required } : cp);
    await saveCheckpoints(updated);
  };

  const pairTag = async (checkpoint) => {
    setPairingId(checkpoint.id);
    try {
      const nfcTagId = await readNfcTag();
      const updated = checkpoints.map(cp => cp.id === checkpoint.id ? { ...cp, nfcTagId, nfcRequired: true } : cp);
      await saveCheckpoints(updated);
      Alert.alert('NFC checkpoint paired', `${checkpoint.name} will require this card during patrols.`);
    } catch (error) { Alert.alert('NFC scan', error.message); }
    finally { setPairingId(null); }
  };

  return (
    <View style={styles.root}>
      <AppHeader />
      <View style={styles.content}>

        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.screenTitle}>Checkpoint Config</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setAddModal(true)}>
            <Plus color={P.white} size={16} />
            <Text style={styles.addBtnTxt}>Add</Text>
          </TouchableOpacity>
        </View>

        {/* Site selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.siteScroll}
          contentContainerStyle={styles.siteScrollContent}
        >
          {mgrSites.map(site => {
            const isActive = selectedSite === site.id;
            return (
              <TouchableOpacity
                key={site.id}
                style={[styles.siteTab, isActive && styles.siteTabActive]}
                onPress={() => setSelectedSite(site.id)}
              >
                <MapPin size={11} color={isActive ? P.info : P.t3} />
                <Text style={[styles.siteTabTxt, isActive && styles.siteTabTxtActive]}>
                  {site.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={styles.countLabel}>
          {siteCheckpoints.length} checkpoint{siteCheckpoints.length !== 1 ? 's' : ''} on this route
        </Text>

        <ScrollView showsVerticalScrollIndicator={false}>
          {siteCheckpoints.length === 0 ? (
            <View style={{ marginTop: SP.px24 }}>
              <EmptyState
                variant="compass"
                title="No checkpoints configured"
                message="Add checkpoints for guards to photograph during patrols at this site."
                actionLabel="Add First Checkpoint"
                onAction={() => setAddModal(true)}
              />
            </View>
          ) : (
            siteCheckpoints.map((cp, i) => (
              <View key={cp.id} style={styles.cpRow}>
                {/* Order badge */}
                <View style={styles.orderBadge}>
                  <Navigation size={12} color={P.info} />
                  <Text style={styles.orderNum}>{i + 1}</Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.cpName}>{cp.name}</Text>
                  <View style={styles.reqRow}>
                    <Text style={styles.reqLabel}>Photo required</Text>
                    <Switch
                      value={cp.required}
                      onValueChange={() => toggleRequired(cp.id)}
                      trackColor={{ true: P.ok, false: P.b3 }}
                      thumbColor={P.white}
                      style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                    />
                    <Text style={[styles.reqState, { color: cp.required ? P.ok : P.t4 }]}>
                      {cp.required ? 'On' : 'Off'}
                    </Text>
                  </View>
                  <View style={styles.reqRow}>
                    <Text style={styles.reqLabel}>NFC card</Text>
                    <Switch
                      value={Boolean(cp.nfcRequired)}
                      disabled={!cp.nfcTagId}
                      onValueChange={value => saveCheckpoints(checkpoints.map(item => item.id === cp.id ? { ...item, nfcRequired: value } : item))}
                      trackColor={{ true: P.info, false: P.b3 }}
                      thumbColor={P.white}
                      style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                    />
                    <Text style={[styles.reqState, { color: cp.nfcRequired ? P.info : P.t4 }]}>
                      {cp.nfcTagId ? (cp.nfcRequired ? 'Required' : 'Paired') : 'Not paired'}
                    </Text>
                    <TouchableOpacity style={styles.pairBtn} onPress={() => pairTag(cp)} disabled={pairingId === cp.id}>
                      {pairingId === cp.id ? <Radio size={14} color={P.info} /> : <ScanLine size={14} color={P.info} />}
                      <Text style={styles.pairTxt}>{pairingId === cp.id ? 'Scan…' : 'Pair'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity onPress={() => handleDelete(cp.id)} style={styles.deleteBtn}>
                  <Trash2 color={P.danger} size={17} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>

        {/* Add Checkpoint Modal */}
        <Modal visible={addModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHead}>
                <Text style={styles.modalTitle}>Add Checkpoint</Text>
                <TouchableOpacity onPress={() => setAddModal(false)} style={styles.closeBtn}>
                  <X color={P.t2} size={18} />
                </TouchableOpacity>
              </View>
              <Text style={styles.siteName}>
                {sites.find(s => s.id === selectedSite)?.name}
              </Text>

              <Text style={styles.fieldLabel}>Checkpoint Name</Text>
              <TextInput
                style={[input, { color: P.t1, marginBottom: SP.px16 }]}
                value={newName}
                onChangeText={setNewName}
                placeholder="e.g. Main Gate, Rear Fence, Server Room..."
                placeholderTextColor={P.t4}
                autoFocus
              />

              <View style={styles.reqToggleRow}>
                <Text style={styles.fieldLabel}>Require Photo</Text>
                <Switch
                  value={newRequired}
                  onValueChange={setNewRequired}
                  trackColor={{ true: P.ok, false: P.b3 }}
                  thumbColor={P.white}
                />
              </View>

              <View style={[styles.reqToggleRow, { marginTop: SP.px12 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Require NFC card</Text>
                  <Text style={styles.nfcHint}>{newNfcTagId ? `Paired card · ${newNfcTagId.slice(-6)}` : 'Pair a tag at this checkpoint'}</Text>
                </View>
                <Switch value={newNfcRequired} onValueChange={setNewNfcRequired} disabled={!newNfcTagId} trackColor={{ true: P.info, false: P.b3 }} thumbColor={P.white} />
              </View>
              <TouchableOpacity style={styles.pairWideBtn} onPress={async () => {
                try { setNewNfcTagId(await readNfcTag()); Alert.alert('NFC card paired', 'This tag will be assigned to the new checkpoint.'); }
                catch (error) { Alert.alert('NFC scan', error.message); }
              }}>
                <ScanLine size={16} color={P.info} />
                <Text style={styles.pairTxt}>{newNfcTagId ? 'Scan a different NFC card' : 'Pair NFC card'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[btnPrimary, { marginTop: SP.px20, opacity: saving ? 0.6 : 1 }]}
                onPress={handleAdd}
                disabled={saving}
              >
                <Plus color={P.white} size={16} />
                <Text style={{ color: P.white, fontSize: 15, fontWeight: '800' }}>
                  {saving ? 'Adding...' : 'Add Checkpoint'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:           { flex: 1, backgroundColor: P.bg0 },
  content:        { flex: 1, padding: SP.px20 },

  headerRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SP.px16 },
  screenTitle:    { ...FONT.h2 },
  addBtn:         { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: P.blue, borderRadius: BR.sm, paddingHorizontal: SP.px16, paddingVertical: 9, ...SH_TOKENS.blue },
  addBtnTxt:      { color: P.white, fontSize: 13, fontWeight: '700' },

  siteScroll:         { maxHeight: 50, marginBottom: SP.px16 },
  siteScrollContent:  { gap: 8, paddingRight: 8 },
  siteTab:            { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: P.bg2, borderRadius: BR.full, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: P.b2 },
  siteTabActive:      { borderColor: P.infoBorder, backgroundColor: P.infoSubtle },
  siteTabTxt:         { color: P.t3, fontSize: 12, fontWeight: '600' },
  siteTabTxtActive:   { color: P.info },

  countLabel:     { color: P.t3, fontSize: 12, fontWeight: '600', marginBottom: SP.px12 },

  cpRow:          { ...card, flexDirection: 'row', alignItems: 'center', padding: SP.px16, marginBottom: SP.px8, gap: 12 },
  orderBadge:     { width: 36, height: 36, borderRadius: 18, backgroundColor: P.infoSubtle, borderWidth: 1, borderColor: P.infoBorder, alignItems: 'center', justifyContent: 'center', gap: 1 },
  orderNum:       { color: P.info, fontSize: 10, fontWeight: '800' },
  cpName:         { color: P.t1, fontSize: 14, fontWeight: '700' },
  reqRow:         { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  reqLabel:       { color: P.t3, fontSize: 11 },
  reqState:       { fontSize: 11, fontWeight: '700' },
  pairBtn:        { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 5, borderRadius: BR.xs, backgroundColor: P.infoSubtle },
  pairWideBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: BR.sm, padding: 11, backgroundColor: P.infoSubtle, marginTop: SP.px8 },
  pairTxt:        { color: P.info, fontSize: 11, fontWeight: '700' },
  nfcHint:        { color: P.t3, fontSize: 11, marginTop: -SP.px4, marginBottom: SP.px8 },
  deleteBtn:      { padding: 6, backgroundColor: P.dangerSubtle, borderRadius: BR.xs },

  modalOverlay:   { flex: 1, backgroundColor: P.overlay, justifyContent: 'center', paddingHorizontal: SP.px20 },
  modalCard:      { backgroundColor: P.bg2, borderRadius: BR.xl, padding: SP.px24, borderWidth: 1, borderColor: P.b2, ...SH_TOKENS.lg },
  modalHead:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SP.px4 },
  modalTitle:     { ...FONT.h3 },
  closeBtn:       { width: 30, height: 30, backgroundColor: P.bg3, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: P.b2 },
  siteName:       { color: P.t3, fontSize: 12, marginBottom: SP.px16 },
  fieldLabel:     { color: P.t2, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SP.px8 },
  reqToggleRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
