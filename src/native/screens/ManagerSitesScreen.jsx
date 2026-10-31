import React, { useMemo, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Building2, ChevronLeft, ChevronRight, MapPin, Pencil, Plus, RefreshCw, Trash2, Users } from 'lucide-react-native';
import { useApp } from '../../context/AppContext';
import { AppHeader } from '../components/AppHeader';
import { EmptyState } from '../components/EmptyState';
import { P, SP, BR, FONT, SH_TOKENS, input, btnPrimary } from '../../ds';
import { isValidWhat3Words, normalizeWhat3Words } from '../../utils/what3words';

const PAGE_SIZE = 10;
const emptySite = { name: '', address: '', postcode: '', what3words: '', latitude: '', longitude: '', geofenceRadiusMetres: '250', notes: '' };
const siteIdOf = site => String(site?.id || site?._id || '');
const guardSiteIds = guard => [...new Set([guard.siteId, ...(guard.assignedSiteIds || [])].map(value => String(value?._id || value?.id || value || '')).filter(Boolean))];

export function ManagerSitesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const safeBottom = Math.max(insets.bottom, 16);
  const { currentUser, sites, users, checkpoints, createSite, updateSite, deleteSite, updateUser, refreshSites, refreshUsers } = useApp();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [editingSite, setEditingSite] = useState(null);
  const [siteDraft, setSiteDraft] = useState(emptySite);
  const [siteModal, setSiteModal] = useState(false);
  const [savingSite, setSavingSite] = useState(false);
  const [siteForGuards, setSiteForGuards] = useState(null);
  const [guardSelection, setGuardSelection] = useState([]);
  const [savingGuards, setSavingGuards] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const currentUserId = String(currentUser?.id || currentUser?._id || '');
  const isAdmin = ['admin', 'superadmin'].includes(currentUser?.role);
  const allowedSiteIds = new Set([
    ...(currentUser?.siteIds || []), ...(currentUser?.managedSiteIds || []),
    ...(currentUser?.siteId ? [currentUser.siteId] : []),
    ...(sites || []).filter(site => String(site.managerId || '') === currentUserId).map(siteIdOf),
  ].map(String));
  const activeSites = (sites || []).filter(site => site.active !== false && (isAdmin || allowedSiteIds.has(siteIdOf(site)) || String(site.managerId || '') === currentUserId));
  const activeGuards = (users || []).filter(user => user.role === 'guard' && user.active !== false && user.status !== 'inactive');
  const filteredSites = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return activeSites;
    return activeSites.filter(site => [site.name, site.address, site.postcode, site.what3words]
      .some(value => String(value || '').toLowerCase().includes(query)));
  }, [activeSites, search]);
  const pageCount = Math.max(1, Math.ceil(filteredSites.length / PAGE_SIZE));
  const visibleSites = filteredSites.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const openCreate = () => {
    setEditingSite(null);
    setSiteDraft({ ...emptySite });
    setSiteModal(true);
  };

  const openEdit = site => {
    setEditingSite(site);
    setSiteDraft({
      name: site.name || '', address: site.address || '', postcode: site.postcode || '',
      what3words: site.what3words || '', latitude: site.latitude == null ? '' : String(site.latitude),
      longitude: site.longitude == null ? '' : String(site.longitude),
      geofenceRadiusMetres: String(site.geofenceRadiusMetres || site.geofenceRadiusMeters || 250),
      notes: site.notes || '',
    });
    setSiteModal(true);
  };

  const saveSite = async () => {
    if (savingSite) return;
    const values = { ...siteDraft, name: siteDraft.name.trim(), address: siteDraft.address.trim(), postcode: siteDraft.postcode.trim(), notes: siteDraft.notes.trim() };
    if (!values.name) return Alert.alert('Site name required', 'Enter a name for this site.');
    const w3w = normalizeWhat3Words(values.what3words);
    if (w3w && !isValidWhat3Words(w3w)) return Alert.alert('Invalid What3Words address', 'Use a valid three word address, for example ///filled.count.soap.');
    const latitude = values.latitude.trim() === '' ? null : Number(values.latitude);
    const longitude = values.longitude.trim() === '' ? null : Number(values.longitude);
    if ((latitude == null) !== (longitude == null) || (latitude != null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) || (longitude != null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))) {
      return Alert.alert('Check coordinates', 'Enter both a valid latitude and longitude, or leave both blank.');
    }
    const radius = Number(values.geofenceRadiusMetres);
    if (!Number.isFinite(radius) || radius < 10 || radius > 10000) return Alert.alert('Check geofence radius', 'Enter a radius between 10 and 10,000 metres.');
    setSavingSite(true);
    try {
      const payload = { ...values, what3words: w3w || null, latitude, longitude, geofenceRadiusMetres: radius };
      const result = editingSite ? await updateSite(siteIdOf(editingSite), payload) : await createSite(payload);
      if (!result?.success) throw new Error(result?.error || 'The site could not be saved.');
      setSiteModal(false);
      Alert.alert(editingSite ? 'Site updated' : 'Site registered', `${result.site?.name || values.name} is saved.`);
    } catch (error) {
      Alert.alert('Could not save site', error.message || 'Check your connection and try again.');
    } finally {
      setSavingSite(false);
    }
  };

  const confirmArchive = site => Alert.alert(
    'Archive site?',
    `${site.name} will be removed from active site lists. Historical reports will be retained.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Archive site', style: 'destructive', onPress: async () => {
        const result = await deleteSite(siteIdOf(site));
        if (!result?.success) Alert.alert('Could not archive site', result?.error || 'Please try again.');
      } },
    ],
  );

  const openGuardAssignments = site => {
    setSiteForGuards(site);
    setGuardSelection(activeGuards.filter(guard => guardSiteIds(guard).includes(siteIdOf(site))).map(guard => String(guard.id || guard._id)));
  };

  const saveGuardAssignments = async () => {
    if (!siteForGuards || savingGuards) return;
    const siteId = siteIdOf(siteForGuards);
    const changed = activeGuards.filter(guard => guardSiteIds(guard).includes(siteId) !== guardSelection.includes(String(guard.id || guard._id)));
    const invalidRemoval = changed.find(guard => guardSiteIds(guard).includes(siteId) && !guardSelection.includes(String(guard.id || guard._id)) && guardSiteIds(guard).length <= 1);
    if (invalidRemoval) return Alert.alert('Guard needs an assigned site', `${invalidRemoval.name} must keep at least one active site. Assign another site before removing this one.`);
    setSavingGuards(true);
    try {
      for (const guard of changed) {
        const ids = guardSiteIds(guard);
        const nextIds = guardSelection.includes(String(guard.id || guard._id))
          ? [...new Set([...ids, siteId])]
          : ids.filter(id => id !== siteId);
        const primarySiteId = nextIds.includes(String(guard.siteId || '')) ? String(guard.siteId) : nextIds[0];
        const result = await updateUser(String(guard.id || guard._id), { siteId: primarySiteId, assignedSiteIds: nextIds });
        if (!result?.success) throw new Error(`${guard.name}: ${result?.error || 'assignment failed'}`);
      }
      setSiteForGuards(null);
      Alert.alert('Assignments saved', 'Guard site assignments have been updated.');
    } catch (error) {
      await refreshUsers();
      Alert.alert('Could not save all assignments', error.message || 'Refresh and try again.');
    } finally {
      setSavingGuards(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    try { await Promise.all([refreshSites(), refreshUsers()]); }
    catch (error) { Alert.alert('Could not refresh sites', error.message || 'Check your connection and try again.'); }
    finally { setRefreshing(false); }
  };

  const checkpointsForSite = siteId => (checkpoints || []).filter(checkpoint => String(checkpoint.siteId?._id || checkpoint.siteId?.id || checkpoint.siteId || '') === siteId && checkpoint.active !== false).length;
  const guardsForSite = siteId => activeGuards.filter(guard => guardSiteIds(guard).includes(siteId)).length;

  return (
    <View style={styles.root}>
      <AppHeader />
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Site management</Text>
            <Text style={styles.subtitle}>Register, update, assign guards, and manage checkpoints.</Text>
          </View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Register site" style={styles.addButton} onPress={openCreate}>
            <Plus size={15} color={P.white} /><Text style={styles.addButtonText}>Add site</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchRow}>
          <TextInput style={styles.searchInput} value={search} onChangeText={value => { setSearch(value); setPage(0); }} placeholder="Search sites, address, or W3W" placeholderTextColor={P.t4} />
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Refresh sites" style={styles.refreshButton} onPress={refresh} disabled={refreshing}>
            <RefreshCw size={17} color={P.blue} />
          </TouchableOpacity>
        </View>

        <Text style={styles.countLabel}>{filteredSites.length} active site{filteredSites.length === 1 ? '' : 's'}</Text>
        <ScrollView style={styles.siteList} contentContainerStyle={{ paddingBottom: safeBottom + SP.px20 }} showsVerticalScrollIndicator={false}>
          {visibleSites.length === 0 ? (
            <EmptyState variant="radar" title={search ? 'No matching sites' : 'No active sites'} message={search ? 'Try another search.' : 'Add a site to start assigning guards and shifts.'} />
          ) : visibleSites.map(site => {
            const id = siteIdOf(site);
            return (
              <View key={id} style={styles.siteCard}>
                <View style={styles.siteHeading}>
                  <View style={styles.siteIcon}><Building2 size={17} color={P.blue} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.siteName}>{site.name}</Text>
                    <Text style={styles.siteAddress} numberOfLines={2}>{[site.address, site.postcode].filter(Boolean).join(' · ') || 'No address added'}</Text>
                  </View>
                </View>
                <View style={styles.siteFacts}>
                  <View style={styles.factItem}><Users size={12} color={P.t3} /><Text style={styles.factText}>{guardsForSite(id)} guards</Text></View>
                  <View style={styles.factItem}><MapPin size={12} color={P.t3} /><Text style={styles.factText}>{checkpointsForSite(id)} checkpoints</Text></View>
                </View>
                {!!site.what3words && <Text style={styles.w3wText}>///{String(site.what3words).replace(/^\/*/, '')}</Text>}
                {(site.latitude != null && site.longitude != null) && <Text style={styles.coordText}>{Number(site.latitude).toFixed(5)}, {Number(site.longitude).toFixed(5)} · {site.geofenceRadiusMetres || site.geofenceRadiusMeters || 250} m radius</Text>}
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.actionButton} onPress={() => openEdit(site)}><Pencil size={13} color={P.blue} /><Text style={styles.actionText}>Edit</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton} onPress={() => openGuardAssignments(site)}><Users size={13} color={P.blue} /><Text style={styles.actionText}>Guards</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton} onPress={() => navigation?.navigate('Checkpoints')}><MapPin size={13} color={P.blue} /><Text style={styles.actionText}>Checkpoints</Text></TouchableOpacity>
                  <TouchableOpacity accessibilityLabel={`Archive ${site.name}`} style={[styles.actionButton, styles.archiveAction]} onPress={() => confirmArchive(site)}><Trash2 size={13} color={P.danger} /><Text style={[styles.actionText, { color: P.danger }]}>Archive</Text></TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>

        {filteredSites.length > PAGE_SIZE && (
          <View style={styles.pagination}>
            <TouchableOpacity accessibilityLabel="Previous sites page" style={styles.pageButton} disabled={page === 0} onPress={() => setPage(value => Math.max(0, value - 1))}><ChevronLeft size={16} color={page === 0 ? P.t4 : P.t1} /></TouchableOpacity>
            <Text style={styles.pageText}>{page + 1} / {pageCount}</Text>
            <TouchableOpacity accessibilityLabel="Next sites page" style={styles.pageButton} disabled={page >= pageCount - 1} onPress={() => setPage(value => Math.min(pageCount - 1, value + 1))}><ChevronRight size={16} color={page >= pageCount - 1 ? P.t4 : P.t1} /></TouchableOpacity>
          </View>
        )}
      </View>

      <Modal visible={siteModal} transparent animationType="slide" onRequestClose={() => setSiteModal(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
          <ScrollView contentContainerStyle={[styles.modalScroll, { paddingBottom: safeBottom + 16 }]} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View><Text style={styles.modalTitle}>{editingSite ? 'Edit site' : 'Register site'}</Text><Text style={styles.modalSub}>W3W lookup is completed by the server when coordinates are provided.</Text></View>
                <TouchableOpacity onPress={() => setSiteModal(false)} style={styles.closeButton}><Text style={styles.closeText}>×</Text></TouchableOpacity>
              </View>
              <Text style={styles.fieldLabel}>Site name *</Text><TextInput style={styles.fieldInput} value={siteDraft.name} onChangeText={name => setSiteDraft(previous => ({ ...previous, name }))} placeholder="e.g. North Gate" placeholderTextColor={P.t4} />
              <Text style={styles.fieldLabel}>Address</Text><TextInput style={styles.fieldInput} value={siteDraft.address} onChangeText={address => setSiteDraft(previous => ({ ...previous, address }))} placeholder="Street address" placeholderTextColor={P.t4} />
              <Text style={styles.fieldLabel}>Postcode</Text><TextInput style={styles.fieldInput} value={siteDraft.postcode} onChangeText={postcode => setSiteDraft(previous => ({ ...previous, postcode }))} placeholder="Postcode" placeholderTextColor={P.t4} autoCapitalize="characters" />
              <Text style={styles.fieldLabel}>What3Words address</Text><TextInput style={styles.fieldInput} value={siteDraft.what3words} onChangeText={what3words => setSiteDraft(previous => ({ ...previous, what3words }))} placeholder="///filled.count.soap" placeholderTextColor={P.t4} autoCapitalize="none" autoCorrect={false} />
              <View style={styles.coordRow}>
                <View style={{ flex: 1 }}><Text style={styles.fieldLabel}>Latitude</Text><TextInput style={styles.fieldInput} value={siteDraft.latitude} onChangeText={latitude => setSiteDraft(previous => ({ ...previous, latitude }))} placeholder="51.5050" placeholderTextColor={P.t4} keyboardType="decimal-pad" /></View>
                <View style={{ flex: 1 }}><Text style={styles.fieldLabel}>Longitude</Text><TextInput style={styles.fieldInput} value={siteDraft.longitude} onChangeText={longitude => setSiteDraft(previous => ({ ...previous, longitude }))} placeholder="-0.0195" placeholderTextColor={P.t4} keyboardType="decimal-pad" /></View>
              </View>
              <Text style={styles.fieldLabel}>Geofence radius (metres)</Text><TextInput style={styles.fieldInput} value={siteDraft.geofenceRadiusMetres} onChangeText={geofenceRadiusMetres => setSiteDraft(previous => ({ ...previous, geofenceRadiusMetres }))} placeholder="250" placeholderTextColor={P.t4} keyboardType="number-pad" />
              <Text style={styles.fieldLabel}>Notes</Text><TextInput style={[styles.fieldInput, styles.notesInput]} value={siteDraft.notes} onChangeText={notes => setSiteDraft(previous => ({ ...previous, notes }))} placeholder="Optional site notes" placeholderTextColor={P.t4} multiline textAlignVertical="top" />
              <TouchableOpacity style={[btnPrimary, { opacity: savingSite ? 0.6 : 1 }]} onPress={saveSite} disabled={savingSite}><Text style={styles.primaryText}>{savingSite ? 'Saving…' : editingSite ? 'Save site changes' : 'Register site'}</Text></TouchableOpacity>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setSiteModal(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={!!siteForGuards} transparent animationType="slide" onRequestClose={() => setSiteForGuards(null)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
          <View style={[styles.modalCard, { maxHeight: '90%', paddingBottom: safeBottom + 20 }]}>
            <Text style={styles.modalTitle}>Assign guards</Text>
            <Text style={styles.modalSub}>Choose active guards for {siteForGuards?.name}. Each guard must keep at least one site.</Text>
            <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled">
              {activeGuards.map(guard => {
                const id = String(guard.id || guard._id);
                const selected = guardSelection.includes(id);
                return <TouchableOpacity key={id} style={styles.guardRow} onPress={() => setGuardSelection(previous => selected ? previous.filter(value => value !== id) : [...previous, id])}><View style={[styles.checkBox, selected && styles.checkBoxSelected]}>{selected ? <Text style={styles.checkMark}>✓</Text> : null}</View><View style={{ flex: 1 }}><Text style={styles.guardName}>{guard.name}</Text><Text style={styles.guardMeta}>{guardSiteIds(guard).map(siteId => activeSites.find(site => siteIdOf(site) === siteId)?.name).filter(Boolean).join(' · ') || 'No active site'}</Text></View></TouchableOpacity>;
              })}
              {!activeGuards.length && <Text style={styles.emptyText}>No active guards are available.</Text>}
            </ScrollView>
            <TouchableOpacity style={[btnPrimary, { marginTop: SP.px12, opacity: savingGuards ? 0.6 : 1 }]} disabled={savingGuards} onPress={saveGuardAssignments}><Text style={styles.primaryText}>{savingGuards ? 'Saving…' : 'Save guard assignments'}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setSiteForGuards(null)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: P.bg0 },
  content: { flex: 1, padding: SP.px20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: SP.px8, marginBottom: SP.px12 },
  title: { ...FONT.h2, color: P.t1 }, subtitle: { color: P.t3, fontSize: 12, lineHeight: 17, marginTop: 3 },
  addButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: SP.px10, borderRadius: BR.sm, backgroundColor: P.blue },
  addButtonText: { color: P.white, fontSize: 11, fontWeight: '800' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: SP.px8, marginBottom: SP.px8 },
  searchInput: { ...input, flex: 1, color: P.t1, paddingVertical: 10 },
  refreshButton: { width: 42, height: 42, borderRadius: BR.sm, borderWidth: 1, borderColor: P.b2, backgroundColor: P.bg2, alignItems: 'center', justifyContent: 'center' },
  countLabel: { color: P.t3, fontSize: 11, fontWeight: '700', marginBottom: SP.px8 },
  siteList: { flex: 1 },
  siteCard: { ...SH_TOKENS.sm, backgroundColor: P.bg2, borderWidth: 1, borderColor: P.b2, borderRadius: BR.md, padding: SP.px16, marginBottom: SP.px10 },
  siteHeading: { flexDirection: 'row', alignItems: 'center', gap: SP.px10 },
  siteIcon: { width: 36, height: 36, borderRadius: BR.sm, backgroundColor: P.blueSubtle, alignItems: 'center', justifyContent: 'center' },
  siteName: { color: P.t1, fontSize: 15, fontWeight: '800' }, siteAddress: { color: P.t3, fontSize: 11, marginTop: 2 },
  siteFacts: { flexDirection: 'row', flexWrap: 'wrap', gap: SP.px16, marginTop: SP.px12 },
  factItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  factText: { color: P.t2, fontSize: 11 },
  w3wText: { color: P.blue, fontSize: 11, fontWeight: '700', marginTop: SP.px8 }, coordText: { color: P.t4, fontSize: 10, marginTop: 3 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: SP.px8, marginTop: SP.px12 },
  actionButton: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: SP.px8, borderRadius: BR.xs, borderWidth: 1, borderColor: P.b2, backgroundColor: P.bg3 },
  archiveAction: { borderColor: P.dangerBorder }, actionText: { color: P.blue, fontSize: 10, fontWeight: '700' },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SP.px16, paddingVertical: SP.px4 },
  pageButton: { width: 34, height: 34, borderRadius: BR.xs, backgroundColor: P.bg2, borderWidth: 1, borderColor: P.b2, alignItems: 'center', justifyContent: 'center' },
  pageText: { color: P.t2, fontSize: 12, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: P.overlay, justifyContent: 'flex-end', paddingHorizontal: SP.px12 },
  modalScroll: { flexGrow: 1, justifyContent: 'flex-end', paddingTop: SP.px24 },
  modalCard: { backgroundColor: P.bg2, borderTopLeftRadius: BR.xl, borderTopRightRadius: BR.xl, padding: SP.px20, borderWidth: 1, borderColor: P.b2, ...SH_TOKENS.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: SP.px8, marginBottom: SP.px12 },
  modalTitle: { ...FONT.h3, color: P.t1 }, modalSub: { color: P.t3, fontSize: 11, lineHeight: 16, marginTop: 3, flexShrink: 1 },
  closeButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: P.bg3, alignItems: 'center', justifyContent: 'center' }, closeText: { color: P.t2, fontSize: 22, lineHeight: 24 },
  fieldLabel: { color: P.t2, fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginBottom: SP.px4, marginTop: SP.px4 },
  fieldInput: { ...input, color: P.t1, paddingVertical: 10, marginBottom: SP.px8 },
  coordRow: { flexDirection: 'row', gap: SP.px8 }, notesInput: { minHeight: 64 },
  primaryText: { color: P.white, fontSize: 14, fontWeight: '800' }, cancelButton: { borderRadius: BR.md, backgroundColor: P.bg3, paddingVertical: 12, alignItems: 'center', marginTop: SP.px8 }, cancelText: { color: P.t2, fontSize: 13 },
  guardRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: P.b1 },
  checkBox: { width: 22, height: 22, borderRadius: BR.xs, borderWidth: 1, borderColor: P.b3, alignItems: 'center', justifyContent: 'center' }, checkBoxSelected: { backgroundColor: P.blue, borderColor: P.blue }, checkMark: { color: P.white, fontSize: 13, fontWeight: '900' },
  guardName: { color: P.t1, fontSize: 13, fontWeight: '700' }, guardMeta: { color: P.t3, fontSize: 10, marginTop: 2 }, emptyText: { color: P.t3, fontSize: 12, paddingVertical: SP.px16 },
});
