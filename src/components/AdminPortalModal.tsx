import React, { useState, useEffect } from 'react';
import { db, User } from '../lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  setDoc,
  getDoc,
  orderBy,
} from 'firebase/firestore';
import { soundFx } from '../utils/audio';
import { UserProfile } from '../types';
import { resetAdminProfile } from '../utils/storage';
import { syncProfileToCloud } from '../lib/sync';
import { grantLifetimeFields, revokeLifetimeFields, resolveEntitlement, entitlementLabel, trialEndMs } from '../lib/entitlement';
import {
  Shield,
  X,
  Crown,
  Users,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Edit2,
  Save,
  Mail,
  Smartphone,
  AlertTriangle,
  Youtube,
  Video,
} from 'lucide-react';

interface PaymentRequest {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  plan: 'annual' | 'monthly' | 'lifetime';
  amountINR: number;
  utrNumber: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: number;
  reviewedAt?: number;
  reviewedBy?: string;
}

interface UserRecord {
  uid: string;
  /** Entitlement fields, so the admin list can show real status. */
  lifetimePro?: boolean;
  trialStartedAt?: string;
  proExpiresAt?: string;
  proPlanType?: string;
  profileData?: any;
  displayName: string;
  email: string;
  photoURL?: string;
  isProUser: boolean;
  createdAt: number;
  lastLoginAt: number;
  authProvider: string;
}

interface Props {
  isOpen: boolean;
  currentUser: User | null;
  profile: UserProfile;
  onClose: () => void;
  onRefreshProfile: () => void;
  onOpenAuthModal?: () => void;
}

const ADMIN_EMAIL = 'unfazed.adibiz@gmail.com';

export const AdminPortalModal: React.FC<Props> = ({
  isOpen,
  currentUser,
  profile,
  onClose,
  onRefreshProfile,
  onOpenAuthModal,
}) => {
  const [activeTab, setActiveTab] = useState<'PAYMENTS' | 'USERS'>('PAYMENTS');
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [registeredUsers, setRegisteredUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Merchant UPI State (Owner editable)
  const [merchantUpi, setMerchantUpi] = useState('unfazed.adibiz@okicici');
  const [isEditingUpi, setIsEditingUpi] = useState(false);
  const [savingUpi, setSavingUpi] = useState(false);

  // Telegram Channel Link State (Owner editable)
  const [telegramLink, setTelegramLink] = useState(() => {
    return localStorage.getItem('elitebrain_telegram_link') || 'https://t.me/masculinecultt';
  });
  const [isEditingTelegram, setIsEditingTelegram] = useState(false);
  const [savingTelegram, setSavingTelegram] = useState(false);
  // Collapsed by default on phones so the account list gets the height.
  const [showConfig, setShowConfig] = useState(false);

  // YouTube Channel Link State (Owner editable)
  const [youtubeLink, setYoutubeLink] = useState(() => {
    return localStorage.getItem('elitebrain_youtube_link') || 'https://www.youtube.com/@xdityasharma';
  });
  const [isEditingYoutube, setIsEditingYoutube] = useState(false);
  const [savingYoutube, setSavingYoutube] = useState(false);

  // Filters
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [searchTerm, setSearchTerm] = useState('');

  const isAdmin = currentUser?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  useEffect(() => {
    if (isOpen && isAdmin) {
      loadData();
      fetchMerchantUpi();
      fetchCommunityLinks();
    }
  }, [isOpen, isAdmin]);

  const fetchMerchantUpi = async () => {
    try {
      const upiDoc = await getDoc(doc(db, 'system_config', 'merchant_payment'));
      if (upiDoc.exists() && upiDoc.data().upiId) {
        setMerchantUpi(upiDoc.data().upiId);
      }
    } catch (err) {
      console.error('Failed to fetch merchant UPI:', err);
    }
  };

  const fetchCommunityLinks = async () => {
    try {
      const commDoc = await getDoc(doc(db, 'system_config', 'community'));
      if (commDoc.exists()) {
        const data = commDoc.data();
        if (data.telegramLink) {
          setTelegramLink(data.telegramLink);
          localStorage.setItem('elitebrain_telegram_link', data.telegramLink);
        }
        if (data.youtubeLink) {
          setYoutubeLink(data.youtubeLink);
          localStorage.setItem('elitebrain_youtube_link', data.youtubeLink);
        }
      }
    } catch (err) {
      console.error('Failed to fetch Community links:', err);
    }
  };

  const handleSaveTelegramLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!telegramLink.trim()) return;

    soundFx.playClick();
    setSavingTelegram(true);
    let cleaned = telegramLink.trim();
    if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
      cleaned = 'https://' + cleaned;
    }

    try {
      await setDoc(doc(db, 'system_config', 'community'), {
        telegramLink: cleaned,
        youtubeLink,
        updatedAt: Date.now(),
        updatedBy: currentUser?.email,
      }, { merge: true });
      setTelegramLink(cleaned);
      localStorage.setItem('elitebrain_telegram_link', cleaned);
      soundFx.playSuccess();
      setIsEditingTelegram(false);
      setActionSuccess(`Official Telegram Channel Link updated to ${cleaned}`);
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to update Telegram link:', err);
      alert('Error saving Telegram link to Firestore.');
    } finally {
      setSavingTelegram(false);
    }
  };

  const handleSaveYoutubeLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeLink.trim()) return;

    soundFx.playClick();
    setSavingYoutube(true);
    let cleaned = youtubeLink.trim();
    if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
      cleaned = 'https://' + cleaned;
    }

    try {
      await setDoc(doc(db, 'system_config', 'community'), {
        telegramLink,
        youtubeLink: cleaned,
        updatedAt: Date.now(),
        updatedBy: currentUser?.email,
      }, { merge: true });
      setYoutubeLink(cleaned);
      localStorage.setItem('elitebrain_youtube_link', cleaned);
      soundFx.playSuccess();
      setIsEditingYoutube(false);
      setActionSuccess(`Official YouTube Channel Link updated to ${cleaned}`);
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to update YouTube link:', err);
      alert('Error saving YouTube link to Firestore.');
    } finally {
      setSavingYoutube(false);
    }
  };

  const handleSaveUpi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchantUpi.trim()) return;

    soundFx.playClick();
    setSavingUpi(true);
    try {
      await setDoc(doc(db, 'system_config', 'merchant_payment'), {
        upiId: merchantUpi.trim(),
        updatedAt: Date.now(),
        updatedBy: currentUser?.email,
      });
      soundFx.playSuccess();
      setIsEditingUpi(false);
      setActionSuccess(`Merchant Receiver UPI updated to ${merchantUpi.trim()}`);
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to update UPI:', err);
      alert('Error saving UPI ID to Firestore.');
    } finally {
      setSavingUpi(false);
    }
  };

  const handleResetAdminProfile = async () => {
    if (!currentUser || currentUser.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) return;
    const confirm = window.confirm(
      `Reset Admin Account (${ADMIN_EMAIL}) to Day 1, 0 EXP, and Bronze 1 Rank?\n\nThis will strictly reset your admin data only without affecting any other registered user.`
    );
    if (!confirm) return;

    soundFx.playClick();
    setLoading(true);
    try {
      const zeroProf = resetAdminProfile(profile);
      await syncProfileToCloud(zeroProf, currentUser);
      soundFx.playSuccess();
      setActionSuccess('Admin account successfully reset to Day 1, 0 EXP, and Bronze 1 Rank!');
      setTimeout(() => setActionSuccess(null), 4000);
      onRefreshProfile();
    } catch (err) {
      console.error('Failed to reset admin profile:', err);
      alert('Error resetting admin profile.');
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Payment Requests
      const reqRef = collection(db, 'payment_requests');
      const reqSnap = await getDocs(query(reqRef, orderBy('createdAt', 'desc')));
      const reqList: PaymentRequest[] = [];
      reqSnap.forEach((d) => {
        reqList.push({ id: d.id, ...d.data() } as PaymentRequest);
      });
      setRequests(reqList);

      // 2. Fetch All Registered Users
      const userRef = collection(db, 'users');
      const userSnap = await getDocs(query(userRef, orderBy('lastLoginAt', 'desc')));
      const userList: UserRecord[] = [];
      userSnap.forEach((d) => {
        const u = d.data();
        userList.push({
          uid: d.id,
          displayName: u.displayName || u.profile?.displayName || 'User',
          email: u.email || u.profile?.email || 'N/A',
          photoURL: u.photoURL,
          // Read the SAME top-level fields the grant writes. This previously
          // read `u.profile.isProUser`, an orphan field nothing writes, so the
          // list always showed false and the button label never changed even
          // though the grant itself had succeeded.
          isProUser: u.isProUser === true,
          lifetimePro: u.lifetimePro === true,
          trialStartedAt: u.trialStartedAt || undefined,
          proPlanType: u.proPlanType || undefined,
          proExpiresAt: u.proExpiresAt || undefined,
          profileData: u.profileData,
          createdAt: u.createdAt || Date.now(),
          lastLoginAt: u.lastLoginAt || Date.now(),
          authProvider: u.authProvider || 'google',
        });
      });
      setRegisteredUsers(userList);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (req: PaymentRequest, status: 'APPROVED' | 'REJECTED') => {
    soundFx.playClick();
    setLoading(true);
    try {
      // Update Payment Request status
      await updateDoc(doc(db, 'payment_requests', req.id), {
        status,
        reviewedAt: Date.now(),
        reviewedBy: currentUser?.email,
      });

      // If APPROVED, grant Pro status on user document
      if (status === 'APPROVED') {
        const userDocRef = doc(db, 'users', req.userId);
        const userSnap = await getDoc(userDocRef);

        const now = Date.now();
        let expiresAtMs: number;
        if (req.plan === 'monthly') {
          expiresAtMs = now + 30 * 24 * 60 * 60 * 1000;
        } else if (req.plan === 'annual') {
          expiresAtMs = now + 365 * 24 * 60 * 60 * 1000;
        } else {
          expiresAtMs = now + 100 * 365 * 24 * 60 * 60 * 1000;
        }

        const expiresAtIso = new Date(expiresAtMs).toISOString();
        const paidAtIso = new Date(now).toISOString();

        if (userSnap.exists()) {
          const uData = userSnap.data();
          const existingProfile = uData.profileData || uData.profile || {};
          const updatedProfile = {
            ...existingProfile,
            isProUser: true,
            proExpiresAt: expiresAtIso,
            proPlanType: req.plan,
            proPaidAt: paidAtIso,
            proAmountPaid: req.amountINR,
            proUtrNumber: req.utrNumber,
          };
          await updateDoc(userDocRef, {
            isProUser: true,
            proExpiresAt: expiresAtIso,
            proPlanType: req.plan,
            proPaidAt: paidAtIso,
            proAmountPaid: req.amountINR,
            proUtrNumber: req.utrNumber,
            profileData: updatedProfile,
            profile: updatedProfile,
          });
        }
      }

      soundFx.playSuccess();
      setActionSuccess(`Payment Request ${status} for ${req.userName}`);
      setTimeout(() => setActionSuccess(null), 3000);
      await loadData();
      onRefreshProfile();
    } catch (err) {
      console.error('Failed to review request:', err);
      alert('Failed to update review status.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleUserPro = async (userRec: UserRecord) => {
    soundFx.playClick();
    setLoading(true);
    try {
      const newProState = !userRec.isProUser;
      const userDocRef = doc(db, 'users', userRec.uid);
      const userSnap = await getDoc(userDocRef);

      if (userSnap.exists()) {
        // The grant must write the SAME fields the app reads. sync.ts and
        // App.tsx both read `data.isProUser` at the top level of the document,
        // and the profile blob lives under `profileData` (not `profile`).
        // Writing to `profile.isProUser` created an orphan field nothing read,
        // which is why granting Pro appeared to succeed but unlocked nothing.
        const uData = userSnap.data();

        // Pricing is a single lifetime tier, so an admin grant is lifetime too.
        const proFields = newProState ? grantLifetimeFields() : revokeLifetimeFields();

        const existingProfileData =
          typeof uData.profileData === 'string'
            ? (() => { try { return JSON.parse(uData.profileData); } catch { return {}; } })()
            : (uData.profileData || {});

        await updateDoc(userDocRef, {
          ...proFields,
          profileData: {
            ...existingProfileData,
            ...proFields,
          },
        });

        soundFx.playSuccess();

        // Reflect the change immediately. A getDocs() straight after a write
        // can still serve the pre-write cache, which is why the button kept
        // showing the old label even though the grant had succeeded.
        setRegisteredUsers((prev) =>
          prev.map((u) =>
            u.uid === userRec.uid
              ? {
                  ...u,
                  isProUser: newProState,
                  lifetimePro: newProState,
                  proExpiresAt: undefined,
                  proPlanType: newProState ? 'lifetime' : undefined,
                }
              : u
          )
        );

        setActionSuccess(`Lifetime Pro ${newProState ? 'GRANTED' : 'REVOKED'} for ${userRec.email}`);
        setTimeout(() => setActionSuccess(null), 3000);
        await loadData();
        onRefreshProfile();
      }
    } catch (err) {
      console.error('Failed to toggle pro:', err);
      alert('Error updating user Pro status.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  if (!isAdmin) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
        <div className="relative w-full max-w-md bg-[#171B22] border border-rose-500/40 rounded-3xl p-6 text-center shadow-2xl text-[#F4F6F8]">
          <div className="w-12 h-12 shrink-0 rounded-2xl bg-rose-500/20 eb-danger flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-6 h-6 shrink-0" />
          </div>
          <h3 className="text-lg font-black text-[#F4F6F8] mb-1">Access Restricted</h3>
          <p className="text-xs text-[#98A2B3] leading-relaxed mb-6">
            The Admin Portal is protected and restricted to authorized administrator accounts.
          </p>

          <button
            onClick={() => {
              soundFx.playClick();
              onClose();
            }}
            className="w-full py-3 rounded-xl bg-[#0E1116] border border-[#2A313C] hover:bg-[#0E1116]/80 text-[#F4F6F8] text-xs font-bold cursor-pointer transition-all active:scale-95"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const filteredRequests = requests.filter((r) => {
    const matchStatus = filterStatus === 'ALL' || r.status === filterStatus;
    const matchSearch =
      r.utrNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.userName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchStatus && matchSearch;
  });

  const filteredUsers = registeredUsers.filter((u) => {
    return (
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.displayName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-4xl bg-[#171B22] border border-[#2A313C] rounded-3xl p-4 sm:p-5 md:p-7 shadow-2xl text-left overflow-hidden h-[92dvh] sm:h-auto sm:max-h-[90vh] flex flex-col text-[#F4F6F8]">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#2A313C] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 flex items-center justify-center text-[#8B5CF6]">
              <Shield className="w-5 h-5 shrink-0" />
            </div>
            <div>
              <h2 className="text-lg font-black text-[#F4F6F8] flex items-center gap-2">
                <span>Cloud Admin & User Management Portal</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#8B5CF6]/20 text-[#8B5CF6] border border-[#8B5CF6]/40">
                  ADMIN ONLY
                </span>
              </h2>
              <p className="text-xs text-[#98A2B3]">
                Review payment UTRs and view all registered users & email lists in real time.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              soundFx.playClick();
              onClose();
            }}
            className="p-2 rounded-xl bg-[#0E1116] border border-[#2A313C] text-[#98A2B3] hover:text-[#F4F6F8] transition-all cursor-pointer"
          >
            <X className="w-4 h-4 shrink-0" />
          </button>
        </div>

        {/* Section Tabs */}
        <div className="flex gap-2 mt-4 shrink-0">
          <button
            onClick={() => {
              soundFx.playClick();
              setActiveTab('PAYMENTS');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'PAYMENTS'
                ? 'bg-[#8B5CF6] text-white shadow-md'
                : 'bg-[#0E1116] text-[#98A2B3] border border-[#2A313C] hover:text-[#F4F6F8]'
            }`}
          >
            <Crown className="w-4 h-4 shrink-0" />
            <span>Payment Requests ({requests.filter(r => r.status === 'PENDING').length} Pending)</span>
          </button>

          <button
            onClick={() => {
              soundFx.playClick();
              setActiveTab('USERS');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'USERS'
                ? 'bg-[#8B5CF6] text-white shadow-md'
                : 'bg-[#0E1116] text-[#98A2B3] border border-[#2A313C] hover:text-[#F4F6F8]'
            }`}
          >
            <Users className="w-4 h-4 shrink-0" />
            <span>Registered Emails & Accounts ({registeredUsers.length})</span>
          </button>
        </div>

        {actionSuccess && (
          <div className="mt-3 p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 eb-done text-xs font-bold flex items-center gap-2 animate-fadeIn shrink-0">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Admin Config Cards (UPI, Telegram, YouTube) */}
        <button
          onClick={() => setShowConfig((v) => !v)}
          className="eb-press md:hidden mt-4 w-full py-2.5 rounded-xl bg-[#0E1116] border border-[#2A313C] text-[11px] font-mono font-bold text-[#98A2B3] shrink-0"
        >
          {showConfig ? '− Hide settings' : '+ Settings (UPI, Telegram, YouTube)'}
        </button>

        <div
          className={`mt-3 md:mt-4 grid-cols-1 md:grid-cols-3 gap-3 shrink-0 ${
            showConfig ? 'grid' : 'hidden md:grid'
          }`}
        >
          {/* Admin Merchant UPI Config Card */}
          <div className="bg-[#0E1116] border border-[#2A313C] rounded-2xl p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="text-[10px] text-[#98A2B3] font-mono uppercase tracking-wider block">
                  Admin Receiver UPI ID
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <Smartphone className="w-4 h-4 eb-done shrink-0" />
                  <span className="text-xs font-mono font-black eb-done truncate max-w-[140px]">
                    {merchantUpi}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setIsEditingUpi(!isEditingUpi)}
                className="px-2.5 py-1 rounded-xl bg-[#171B22] hover:bg-[#2A313C] text-[#F4F6F8] text-xs font-bold cursor-pointer transition-all flex items-center gap-1 border border-[#2A313C] shrink-0"
              >
                <Edit2 className="w-3 h-3 shrink-0" />
                <span>{isEditingUpi ? 'Cancel' : 'Edit'}</span>
              </button>
            </div>

            {isEditingUpi && (
              <form onSubmit={handleSaveUpi} className="mt-3 pt-3 border-t border-[#2A313C] flex gap-2">
                <input
                  type="text"
                  value={merchantUpi}
                  onChange={(e) => setMerchantUpi(e.target.value)}
                  placeholder="e.g. name@upi"
                  className="flex-1 min-w-0 bg-[#171B22] border border-[#2A313C] rounded-xl px-3 py-1.5 text-xs font-mono text-[#F4F6F8] focus:border-[#8B5CF6] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={savingUpi}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 cursor-pointer transition-all flex items-center gap-1 disabled:opacity-50 shrink-0"
                >
                  <Save className="w-3 h-3 shrink-0" />
                  <span>{savingUpi ? 'Saving...' : 'Save'}</span>
                </button>
              </form>
            )}
          </div>

          {/* Admin Telegram Channel Link Config Card */}
          <div className="bg-[#0E1116] border border-[#2A313C] rounded-2xl p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="text-[10px] text-[#98A2B3] font-mono uppercase tracking-wider block">
                  Telegram Channel Link
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <Mail className="w-4 h-4 text-sky-400 shrink-0" />
                  <span className="text-xs font-mono font-black text-sky-300 truncate max-w-[140px]">
                    {telegramLink}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setIsEditingTelegram(!isEditingTelegram)}
                className="px-2.5 py-1 rounded-xl bg-[#171B22] hover:bg-[#2A313C] text-[#F4F6F8] text-xs font-bold cursor-pointer transition-all flex items-center gap-1 border border-[#2A313C] shrink-0"
              >
                <Edit2 className="w-3 h-3 shrink-0" />
                <span>{isEditingTelegram ? 'Cancel' : 'Edit'}</span>
              </button>
            </div>

            {isEditingTelegram && (
              <form onSubmit={handleSaveTelegramLink} className="mt-3 pt-3 border-t border-[#2A313C] flex gap-2">
                <input
                  type="url"
                  value={telegramLink}
                  onChange={(e) => setTelegramLink(e.target.value)}
                  placeholder="https://t.me/yourchannel"
                  className="flex-1 min-w-0 bg-[#171B22] border border-[#2A313C] rounded-xl px-3 py-1.5 text-xs font-mono text-[#F4F6F8] focus:border-sky-400 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={savingTelegram}
                  className="px-3 py-1.5 rounded-xl bg-sky-500 text-slate-950 font-bold text-xs hover:bg-sky-400 cursor-pointer transition-all flex items-center gap-1 disabled:opacity-50 shrink-0"
                >
                  <Save className="w-3 h-3 shrink-0" />
                  <span>{savingTelegram ? 'Saving...' : 'Save'}</span>
                </button>
              </form>
            )}
          </div>

          {/* Admin YouTube Channel Link Config Card */}
          <div className="bg-[#0E1116] border border-[#2A313C] rounded-2xl p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="text-[10px] text-[#98A2B3] font-mono uppercase tracking-wider block">
                  YouTube Channel Link
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <Youtube className="w-4 h-4 text-red-400 shrink-0" />
                  <span className="text-xs font-mono font-black text-red-300 truncate max-w-[140px]">
                    {youtubeLink}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setIsEditingYoutube(!isEditingYoutube)}
                className="px-2.5 py-1 rounded-xl bg-[#171B22] hover:bg-[#2A313C] text-[#F4F6F8] text-xs font-bold cursor-pointer transition-all flex items-center gap-1 border border-[#2A313C] shrink-0"
              >
                <Edit2 className="w-3 h-3 shrink-0" />
                <span>{isEditingYoutube ? 'Cancel' : 'Edit'}</span>
              </button>
            </div>

            {isEditingYoutube && (
              <form onSubmit={handleSaveYoutubeLink} className="mt-3 pt-3 border-t border-[#2A313C] flex gap-2">
                <input
                  type="url"
                  value={youtubeLink}
                  onChange={(e) => setYoutubeLink(e.target.value)}
                  placeholder="https://www.youtube.com/@channel"
                  className="flex-1 min-w-0 bg-[#171B22] border border-[#2A313C] rounded-xl px-3 py-1.5 text-xs font-mono text-[#F4F6F8] focus:border-red-400 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={savingYoutube}
                  className="px-3 py-1.5 rounded-xl bg-red-600 text-white font-bold text-xs hover:bg-red-500 cursor-pointer transition-all flex items-center gap-1 disabled:opacity-50 shrink-0"
                >
                  <Save className="w-3 h-3 shrink-0" />
                  <span>{savingYoutube ? 'Saving...' : 'Save'}</span>
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Toolbar: Filters & Search */}
        <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          {activeTab === 'PAYMENTS' ? (
            <div className="flex items-center gap-1 bg-[#0E1116] p-1 rounded-xl border border-[#2A313C]">
              {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => {
                    soundFx.playClick();
                    setFilterStatus(st);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                    filterStatus === st
                      ? 'bg-[#8B5CF6] text-white shadow-md'
                      : 'text-[#98A2B3] hover:text-[#F4F6F8]'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-xs font-bold text-[#8B5CF6] font-mono flex items-center gap-2">
              <Mail className="w-4 h-4 shrink-0 text-[#8B5CF6]" />
              <span>Total Registered Accounts: {registeredUsers.length}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0 sm:w-64">
              <Search className="w-3.5 h-3.5 shrink-0 text-[#98A2B3] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={activeTab === 'PAYMENTS' ? 'Search UTR, name, email...' : 'Search name or email address...'}
                className="w-full bg-[#0E1116] border border-[#2A313C] rounded-xl pl-9 pr-3 py-2.5 text-xs text-[#F4F6F8] placeholder:text-[#98A2B3] focus:border-[#8B5CF6] focus:outline-none"
              />
            </div>

            <button
              onClick={loadData}
              title="Refresh data"
              aria-label="Refresh data"
              className="eb-press shrink-0 w-11 h-11 rounded-xl bg-[#0E1116] border border-[#2A313C] hover:bg-[#171B22] text-[#98A2B3] hover:text-[#F4F6F8] flex items-center justify-center cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Content View */}
        <div className="mt-4 flex-1 min-h-[38vh] overflow-y-auto overscroll-contain custom-scrollbar space-y-3 pr-1 pb-2">
          {activeTab === 'PAYMENTS' ? (
            filteredRequests.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-[#2A313C] rounded-2xl">
                <Clock className="w-8 h-8 shrink-0 text-[#98A2B3] mx-auto mb-2" />
                <p className="text-xs text-[#98A2B3] font-mono">
                  No payment requests found for status "{filterStatus}".
                </p>
              </div>
            ) : (
              filteredRequests.map((req) => (
                <div
                  key={req.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    req.status === 'PENDING'
                      ? 'bg-[#0E1116] border-amber-500/40 shadow-lg'
                      : req.status === 'APPROVED'
                      ? 'bg-[#0E1116] border-emerald-500/30'
                      : 'bg-[#0E1116] border-[#2A313C] opacity-60'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-[#F4F6F8]">{req.userName}</span>
                        <span className="text-[11px] text-[#98A2B3]">({req.userEmail})</span>
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                            req.status === 'PENDING'
                              ? 'bg-amber-500/20 eb-warn border-amber-500/40'
                              : req.status === 'APPROVED'
                              ? 'bg-emerald-500/20 eb-done border-emerald-500/40'
                              : 'bg-rose-500/20 eb-danger border-rose-500/40'
                          }`}
                        >
                          {req.status}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-[#98A2B3] font-mono">
                        <span>
                          Plan: <strong className="text-[#8B5CF6]">{req.plan.toUpperCase()}</strong> (₹{req.amountINR})
                        </span>
                        <span>•</span>
                        <span className="bg-[#171B22] px-2 py-0.5 rounded-md border border-[#2A313C] eb-warn font-bold">
                          UTR / Ref: {req.utrNumber}
                        </span>
                      </div>

                      <div className="text-[10px] text-[#98A2B3] font-mono">
                        Submitted: {new Date(req.createdAt).toLocaleString()}
                      </div>
                    </div>

                    {/* Actions for Pending Requests */}
                    {req.status === 'PENDING' ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleReview(req, 'APPROVED')}
                          disabled={loading}
                          className="px-3.5 py-2 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs hover:bg-emerald-400 cursor-pointer shadow-md transition-all active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>Approve & Grant Pro</span>
                        </button>

                        <button
                          onClick={() => handleReview(req, 'REJECTED')}
                          disabled={loading}
                          className="px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 eb-danger font-bold text-xs cursor-pointer transition-all active:scale-95 flex items-center gap-1 disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4 shrink-0" />
                          <span>Reject</span>
                        </button>
                      </div>
                    ) : (
                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-mono text-[#98A2B3] block">
                          Reviewed: {req.reviewedAt ? new Date(req.reviewedAt).toLocaleDateString() : 'N/A'}
                        </span>
                        <span className="text-[10px] font-mono text-[#98A2B3] block">
                          By: {req.reviewedBy}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )
          ) : (
            /* Registered Users / Email List */
            filteredUsers.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-[#2A313C] rounded-2xl">
                <Users className="w-8 h-8 shrink-0 text-[#98A2B3] mx-auto mb-2" />
                <p className="text-xs text-[#98A2B3] font-mono">
                  No registered users match your search.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredUsers.map((u) => (
                  <div
                    key={u.uid}
                    className="eb-shine eb-lift eb-glow-brand p-3.5 rounded-2xl bg-[#0E1116] border border-[#2A313C] hover:border-[#8B5CF6]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      {u.photoURL ? (
                        <img src={u.photoURL} alt={u.displayName} className="w-9 h-9 rounded-full border border-[#8B5CF6]/40 object-cover shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 text-[#8B5CF6] font-bold text-xs flex items-center justify-center shrink-0">
                          {u.displayName ? u.displayName[0].toUpperCase() : 'U'}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black text-[#F4F6F8] truncate max-w-full">{u.displayName}</span>
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#171B22] border border-[#2A313C] text-[#98A2B3] uppercase">
                            {u.authProvider}
                          </span>
                          {(() => {
                            const e = resolveEntitlement({
                              ...(typeof (u as any).profileData === 'object' ? (u as any).profileData : {}),
                              lifetimePro: (u as any).lifetimePro === true,
                              trialStartedAt: (u as any).trialStartedAt,
                              proExpiresAt: (u as any).proExpiresAt,
                              isProUser: u.isProUser,
                            });
                            const tone =
                              e.status === 'lifetime' ? 'bg-amber-500/20 eb-warn border-amber-500/40'
                              : e.status === 'trial' ? 'bg-emerald-500/20 eb-done border-emerald-500/40'
                              : e.status === 'expired' ? 'bg-rose-500/20 eb-danger border-rose-500/40'
                              : 'bg-[#171B22] text-[#98A2B3] border-[#2A313C]';
                            return (
                              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 ${tone}`}>
                                {e.status === 'lifetime' && <Crown className="w-3 h-3 shrink-0 eb-warn" />}
                                {entitlementLabel(e).toUpperCase()}
                              </span>
                            );
                          })()}
                        </div>
                        <div className="text-[11px] font-mono text-[#8B5CF6] mt-0.5 break-all">{u.email}</div>
                        <div className="text-[10px] text-[#98A2B3] font-mono mt-0.5">
                          Registered: {new Date(u.createdAt).toLocaleDateString()} • Last Active: {new Date(u.lastLoginAt).toLocaleTimeString()}
                        </div>
                        {(u as any).trialStartedAt && (
                          <div className="text-[10px] text-[#98A2B3] font-mono mt-0.5">
                            Trial: {new Date((u as any).trialStartedAt).toLocaleDateString()} → {(() => {
                              const end = trialEndMs((u as any).trialStartedAt);
                              return end ? new Date(end).toLocaleDateString() : '—';
                            })()}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                      <button
                        onClick={() => handleToggleUserPro(u)}
                        disabled={loading}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 ${
                          u.isProUser
                            ? 'bg-rose-500/20 hover:bg-rose-500/30 eb-danger border border-rose-500/40'
                            : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md font-black'
                        }`}
                      >
                        <Crown className="w-3.5 h-3.5 shrink-0" />
                        <span>{u.isProUser ? 'Revoke Pro' : 'Grant Lifetime'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};
