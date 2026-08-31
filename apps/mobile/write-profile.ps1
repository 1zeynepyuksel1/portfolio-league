import { useCallback, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
  Modal,
  TextInput,
  SafeAreaView,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { apiFetch } from '../api/client';
import { AssetLogo } from '../components/AssetLogo';
import { AllocationBar, colorForLabel } from '../components/AllocationBar';
import { colors, fonts, spacing } from '../theme';
import { TrendingUp, TrendingDown, Trophy, Award, Users, Lock, Globe, Settings, ChevronRight, X, User } from 'lucide-react-native';
import { createAvatar } from '@dicebear/core';
import { bottts } from '@dicebear/collection';
import { SvgXml } from 'react-native-svg';

type ProfileSlice = {
  symbol: string;
  name: string;
  sharePercent: string | null;
  profitPercent: string | null;
};

type PublicProfile = {
  username: string;
  firstName: string;
  lastName: string;
  avatarSeed?: string | null;
  avatarStyle?: string | null;
  isSelf: boolean;
  isFriend: boolean;
  isPublic: boolean;
  visible: boolean;
  twrPercent: string | null;
  rank: number | null;
  totalParticipants: number | null;
  achievementsCount?: number;
  allocation: ProfileSlice[];
  pending: 'outgoing' | 'incoming' | null;
  friendCount: number;
  pendingRequests: number;
};

export function ProfileScreen({
  username,
  onClose,
  onOpenFriends,
  onLogout,
}: {
  username: string;
  onClose?: () => void;
  onOpenFriends?: () => void;
  onLogout?: () => void;
}) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editIsPublic, setEditIsPublic] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState('');

  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await apiFetch<{ profile: PublicProfile }>(/users/ + username);
      setProfile(res.profile);
      setEditFirstName(res.profile.firstName || '');
      setEditLastName(res.profile.lastName || '');
      setEditUsername(res.profile.username || '');
      setEditIsPublic(res.profile.isPublic);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Profil yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [username]);

  // Initial load
  useCallback(() => {
    void load();
  }, [load])(); // wait, better use useEffect
  
  // Actually, wait, useCallback with IIFE is wrong, let me fix it via a separate script to properly write useEffect.
  // I will write this file carefully.
