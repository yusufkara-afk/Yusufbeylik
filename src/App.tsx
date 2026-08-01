import { useState, useEffect, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  LayoutDashboard,
  Package,
  Settings,
  User,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Loader2,
  PackageX,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Link2,
  Unlink2,
  Clock,
  RefreshCw,
  Crown,
  Lock,
  Calendar,
  CreditCard,
  Shield,
  Heart,
  Target,
  Zap,
  Lightbulb,
  LinkIcon,
} from 'lucide-react';
import { supabase, getSupabaseError } from './lib/supabase';
import type { Profile, Claim, ClaimReasonSummary, ProductClaimStats } from './lib/supabase';

type View = 'dashboard' | 'products' | 'settings' | 'product-detail' | 'about' | 'payment-success' | 'payment-failed' | 'connect-trendyol' | 'erken-erisim';

// ─── Recommendations based on reason patterns ─────────────────────────────────

const RECOMMENDATIONS: Record<string, { title: string; description: string; stat: string }> = {
  'Beden uyumsuzluğu': {
    title: 'Beden Tablosu Ekleyin',
    description: 'Ürün açıklamanıza detaylı beden tablosu ekleyin. "Bu ürün dar kalıptır, bir beden büyük almanızı öneririz" gibi bir uyarı iadeleri önemli ölçüde azaltabilir.',
    stat: 'Bu adımı uygulayan satıcılar iade oranlarını ortalama %15-20 azalttı.',
  },
  'Kalite sorunu': {
    title: 'Görselleri Güncelleyin',
    description: 'Ürün fotoğraflarınızı güncelleyin, gerçek ürünü tüm açılardan gösteren detaylı görseller ekleyin. Açıklamada malzeme ve kalite detaylarına yer verin.',
    stat: 'Gerçekçi görseller kullanmak müşteri memnuniyetini %25 artırır.',
  },
  'Renk uyuşmazlığı': {
    title: 'Renk Bilgisi Netleştirin',
    description: 'Ürün açıklamanızı güncelleyin. Renk bilgilerini netleştirin, farklı ışık koşullarında çekilmiş fotoğraflar ekleyin.',
    stat: 'Detaylı renk açıklaması renk kaynaklı iadeleri %30 azaltır.',
  },
  'Hasarlı ürün': {
    title: 'Paketlemeyi Güçlendirin',
    description: 'Kargo paketlemenizi güçlendirin. Kırılgan ürünler için balonlu naylon ve sağlam kutu kullanımı iade oranını düşürür.',
    stat: 'Güçlü paketleme hasar kaynaklı iadeleri %40 azaltır.',
  },
  'Diğer': {
    title: 'Müşteri Geri Bildirimlerini Takip Edin',
    description: 'İade nedenlerini daha iyi analiz etmek için müşteri yorumlarınızı düzenli takip edin. Ortak kalıpları tespit edin.',
    stat: 'Düzenli analiz iade nedenlerini %20 daha hızlı tespit etmenizi sağlar.',
  },
};

function getRecommendation(reason: string): { title: string; description: string; stat: string } {
  return RECOMMENDATIONS[reason] || RECOMMENDATIONS['Diğer'];
}

// ─── Plan Helpers ────────────────────────────────────────────────────────────

const PLAN_PRICES = {
  monthly: { usd: 39, try: 1320, label: 'Aylık' },
  yearly: { usd: 349, try: 11832, label: 'Yıllık' },
};

function getDaysRemaining(endDate: string): number {
  const end = new Date(endDate);
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function isPlanActive(profile: Profile): boolean {
  if (profile.plan_type === 'trial') {
    return getDaysRemaining(profile.trial_ends_at) > 0;
  }
  if (profile.plan_type === 'monthly' || profile.plan_type === 'yearly') {
    if (!profile.subscription_ends_at) return true;
    return new Date(profile.subscription_ends_at) > new Date();
  }
  return false;
}

function getPlanStatus(profile: Profile): { label: string; daysLeft: number; isActive: boolean } {
  const isActive = isPlanActive(profile);

  if (profile.plan_type === 'trial') {
    const daysLeft = getDaysRemaining(profile.trial_ends_at);
    return { label: 'Deneme Sürümü', daysLeft, isActive: daysLeft > 0 };
  }

  if (profile.plan_type === 'monthly') {
    const daysLeft = profile.subscription_ends_at
      ? getDaysRemaining(profile.subscription_ends_at)
      : 30;
    return { label: 'Aylık Pro', daysLeft, isActive };
  }

  if (profile.plan_type === 'yearly') {
    const daysLeft = profile.subscription_ends_at
      ? getDaysRemaining(profile.subscription_ends_at)
      : 365;
    return { label: 'Yıllık Pro', daysLeft, isActive };
  }

  return { label: 'Süresi Dolmuş', daysLeft: 0, isActive: false };
}

// ─── Trendyol API Client ─────────────────────────────────────────────────────

interface TrendyolStatus {
  connected: boolean;
  status?: string;
  last_sync_at?: string;
  error_message?: string;
  seller_id?: string;
  connected_at?: string;
}

async function getTrendyolStatus(): Promise<TrendyolStatus> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { connected: false };

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trendyol-sync/status`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (!response.ok) return { connected: false };
  return response.json();
}

async function testTrendyolConnection(
  sellerId: string,
  apiKey: string,
  apiSecret: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { success: false, error: 'Oturum bulunamadı' };

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trendyol-sync/test-connection`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ seller_id: sellerId, api_key: apiKey, api_secret: apiSecret }),
  });

  return response.json();
}

async function syncTrendyolClaims(): Promise<{ success: boolean; message?: string; claimsProcessed?: number; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { success: false, error: 'Oturum bulunamadı' };

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trendyol-sync/sync-claims`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  return response.json();
}

async function disconnectTrendyol(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trendyol-sync/disconnect`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
}

// ─── PayTR Payment ───────────────────────────────────────────────────────────

async function createPaymentLink(
  plan: 'monthly' | 'yearly'
): Promise<{ success: boolean; payment_url?: string; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { success: false, error: 'Oturum bulunamadı' };

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paytr-payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ plan }),
  });

  return response.json();
}

// ─── Auth Page ─────────────────────────────────────────────────────────────

type AuthMode = 'login' | 'register';

function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isLogin = mode === 'login';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isLogin && password !== confirmPassword) {
      setError('Şifreler eşleşmiyor.');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Bir hata oluştu.';
      if (msg.includes('Invalid login credentials')) {
        setError('E-posta veya şifre hatalı.');
      } else if (msg.includes('User already registered')) {
        setError('Bu e-posta zaten kayıtlı. Giriş yapın.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary-bg px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-text mb-2">
            <span className="text-primary-cyan">İade</span>Nabız
          </h1>
          <p className="text-primary-muted">
            {isLogin ? 'Hesabınıza giriş yapın' : 'Yeni hesap oluşturun'}
          </p>
        </div>

        <div className="card">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-primary-muted mb-2">E-posta</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="ornek@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-primary-muted mb-2">Şifre</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="********"
                minLength={6}
                required
              />
            </div>

            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-primary-muted mb-2">Şifre Tekrar</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input-field"
                  placeholder="********"
                  minLength={6}
                  required
                />
              </div>
            )}

            {error && (
              <p className="text-sm text-status-stop bg-status-stop/10 border border-status-stop/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary mt-2 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isLogin ? 'Giriş Yap' : 'Kayıt Ol'}
            </button>
          </form>

          {!isLogin && (
            <p className="text-xs text-primary-muted text-center mt-4">
              Kayıt olarak 7 gün ücretsiz deneme süresi kazanırsınız.
            </p>
          )}
        </div>

        <p className="text-center text-primary-muted mt-6">
          {isLogin ? (
            <>
              Hesabın yok mu?{' '}
              <button
                onClick={() => { setMode('register'); setError(''); }}
                className="text-primary-cyan hover:underline font-medium"
              >
                Kayıt ol
              </button>
            </>
          ) : (
            <>
              Zaten hesabın var mı?{' '}
              <button
                onClick={() => { setMode('login'); setError(''); }}
                className="text-primary-cyan hover:underline font-medium"
              >
                Giriş yap
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

// ─── Logo Component ─────────────────────────────────────────────────────────

function Logo({ className = 'h-9' }: { className?: string }) {
  return (
    <span className={`font-bold text-primary-text ${className}`}>
      <span className="text-primary-cyan">İade</span>Nabız
    </span>
  );
}

// ─── Shared Components ─────────────────────────────────────────────────────

function Layout({
  session,
  view,
  setView,
  children,
}: {
  session: Session;
  view: View;
  setView: (v: View) => void;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const navItems = [
    { id: 'dashboard' as View, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'products' as View, label: 'Ürünler', icon: Package },
    { id: 'about' as View, label: 'Hakkımızda', icon: Heart },
    { id: 'settings' as View, label: 'Ayarlar', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-primary-bg flex">
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-primary-card transform transition-transform duration-200 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-center p-5 border-b border-gray-800">
          <Logo />
        </div>

        <nav className="p-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { setView(item.id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                view === item.id
                  ? 'bg-primary-accent/10 text-primary-accent font-medium'
                  : 'text-primary-muted hover:bg-primary-bg hover:text-primary-text'
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-primary-card border-b border-gray-800 px-4 lg:px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 text-primary-muted hover:text-primary-text"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="lg:hidden flex items-center">
              <Logo className="text-xl" />
            </div>

            <div className="hidden lg:flex items-center">
              <span className="text-sm text-primary-muted">{session.user.email}</span>
            </div>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-primary-bg transition-colors text-primary-muted hover:text-primary-text"
              >
                <User className="w-5 h-5" />
                <span className="hidden sm:inline text-sm">Profil</span>
              </button>

              {profileDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setProfileDropdownOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-72 bg-primary-card border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
                    <div className="p-4 border-b border-gray-700">
                      <p className="text-xs text-primary-muted mb-1">E-posta</p>
                      <p className="text-primary-text font-medium truncate">{session.user.email}</p>
                    </div>
                    <div className="p-4 border-b border-gray-700">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-primary-muted">Hesap Durumu</span>
                        <span className="text-status-go text-sm flex items-center gap-1">
                          <CheckCircle className="w-4 h-4" /> Aktif
                        </span>
                      </div>
                    </div>
                    <div className="p-2">
                      <button
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          setView('settings');
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-primary-muted hover:bg-primary-bg hover:text-primary-text transition-colors text-left"
                      >
                        <Settings className="w-4 h-4" />
                        <span className="text-sm">Ayarlar</span>
                      </button>
                      <button
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          handleSignOut();
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-status-stop hover:bg-status-stop/10 transition-colors text-left"
                      >
                        <User className="w-4 h-4" />
                        <span className="text-sm">Çıkış Yap</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

function getStatusConfig(status: 'stop' | 'watch' | 'go') {
  return {
    stop: { label: 'Durdur', color: 'bg-status-stop', textColor: 'text-white', icon: AlertTriangle },
    watch: { label: 'İzle', color: 'bg-status-watch', textColor: 'text-primary-bg', icon: TrendingDown },
    go: { label: 'Devam Et', color: 'bg-status-go', textColor: 'text-white', icon: CheckCircle },
  }[status];
}

// ─── Trial/Plan Banner ─────────────────────────────────────────────────────

function PlanBanner({ profile, setView }: { profile: Profile; setView: (v: View) => void }) {
  const planStatus = getPlanStatus(profile);

  if (profile.plan_type === 'trial' && planStatus.isActive) {
    return (
      <div className="mb-6 bg-primary-cyan/10 border border-primary-cyan/30 rounded-lg px-4 py-3 flex items-center gap-3">
        <div className="p-2 bg-primary-cyan/20 rounded-lg">
          <Clock className="w-5 h-5 text-primary-cyan" />
        </div>
        <div className="flex-1">
          <p className="text-primary-text font-medium">
            Deneme sürenizin bitmesine {planStatus.daysLeft} gün kaldı
          </p>
          <p className="text-sm text-primary-muted">
            Tüm özelliklere erişmek için{' '}
            <button onClick={() => setView('settings')} className="text-primary-cyan hover:underline">
              Pro'ya geçin
            </button>
          </p>
        </div>
      </div>
    );
  }

  if (!planStatus.isActive) {
    return (
      <div className="mb-6 bg-status-stop/10 border border-status-stop/30 rounded-lg px-4 py-3 flex items-center gap-3">
        <div className="p-2 bg-status-stop/20 rounded-lg">
          <Lock className="w-5 h-5 text-status-stop" />
        </div>
        <div className="flex-1">
          <p className="text-primary-text font-medium">
            {profile.plan_type === 'trial' ? 'Deneme süreniz doldu' : 'Üyeliğiniz sona erdi'}
          </p>
          <p className="text-sm text-primary-muted">
            Devam etmek için{' '}
            <button onClick={() => setView('settings')} className="text-primary-cyan hover:underline">
              Pro'ya geçin
            </button>
          </p>
        </div>
      </div>
    );
  }

  return null;
}

// ─── Connect Trendyol Page ───────────────────────────────────────────────────

function ConnectTrendyolPage({ onConnected }: { onConnected: () => void }) {
  const [sellerId, setSellerId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');

  const handleConnect = async () => {
    if (!sellerId || !apiKey || !apiSecret) {
      setError('Tüm alanları doldurun');
      return;
    }

    setConnecting(true);
    setError('');

    const result = await testTrendyolConnection(sellerId, apiKey, apiSecret);

    if (result.success) {
      onConnected();
    } else {
      setError(result.error || 'Bağlantı kurulamadı');
    }

    setConnecting(false);
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="text-center mb-6">
        <div className="p-4 bg-primary-cyan/10 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
          <LinkIcon className="w-10 h-10 text-primary-cyan" />
        </div>
        <h2 className="text-2xl font-bold text-primary-text mb-2">Trendyol Hesabını Bağla</h2>
        <p className="text-primary-muted">
          İade verilerinizi çekmek için Trendyol API bilgilerinizi girin.
        </p>
      </div>

      <div className="card">
        <div className="bg-primary-bg rounded-lg p-4 mb-6">
          <p className="text-sm text-primary-muted flex items-start gap-2">
            <Shield className="w-4 h-4 mt-0.5 shrink-0 text-primary-cyan" />
            <span>
              API bilgilerinizi{' '}
              <strong className="text-primary-text">Trendyol Satıcı Paneli &gt; Hesap Bilgilerim &gt; Entegrasyon Bilgileri</strong>{' '}
              sayfasından alabilirsiniz. Verileriniz şifrelenerek saklanır.
            </span>
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-primary-muted mb-2">
              Satıcı ID (Supplier ID)
            </label>
            <input
              type="text"
              value={sellerId}
              onChange={(e) => setSellerId(e.target.value)}
              className="input-field"
              placeholder="Örn: 123456"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-muted mb-2">API Key</label>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="input-field"
              placeholder="API anahtarınızı girin"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-muted mb-2">API Secret</label>
            <input
              type="password"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              className="input-field"
              placeholder="API secretınızı girin"
            />
          </div>

          {error && (
            <p className="text-sm text-status-stop bg-status-stop/10 border border-status-stop/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            onClick={handleConnect}
            disabled={connecting}
            className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {connecting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Link2 className="w-5 h-5" />}
            Bağlan
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard Page ────────────────────────────────────────────────────────

function DashboardPage({
  claims,
  reasonSummaries,
  productStats,
  loadingClaims,
  setView,
  setSelectedProductBarcode,
  trendyolConnected,
  profile,
  onSync,
  syncing,
}: {
  claims: Claim[];
  reasonSummaries: ClaimReasonSummary[];
  productStats: ProductClaimStats[];
  loadingClaims: boolean;
  setView: (v: View) => void;
  setSelectedProductBarcode: (barcode: string | null) => void;
  trendyolConnected: boolean;
  profile: Profile | null;
  onSync: () => void;
  syncing: boolean;
}) {
  const planActive = profile ? isPlanActive(profile) : true;

  // Show connect prompt if not connected
  if (!trendyolConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="p-4 bg-primary-cyan/10 rounded-full w-20 h-20 mb-6 flex items-center justify-center">
          <LinkIcon className="w-10 h-10 text-primary-cyan" />
        </div>
        <h2 className="text-2xl font-bold text-primary-text mb-2">Henüz Veri Yok</h2>
        <p className="text-primary-muted max-w-md mb-6">
          İade verilerinizi görmek için Trendyol hesabınızı bağlamanız gerekiyor.
        </p>
        <button
          onClick={() => setView('connect-trendyol')}
          className="btn-primary flex items-center gap-2"
        >
          <Link2 className="w-5 h-5" />
          Trendyol Hesabını Bağla
        </button>
      </div>
    );
  }

  // Calculate stats from real data
  const totalClaims = claims.length;
  const avgReturnRate = productStats.length > 0 && totalClaims > 0
    ? ((productStats.reduce((s, p) => s + p.total_claims, 0) / totalClaims) * 100).toFixed(1)
    : '0';
  const totalQuantity = claims.reduce((sum, c) => sum + c.quantity, 0);

  // Get top reason
  const topReason = reasonSummaries.length > 0
    ? reasonSummaries.reduce((max, r) => r.count > max.count ? r : max, reasonSummaries[0])
    : null;
  const recommendation = topReason ? getRecommendation(topReason.reason) : null;

  // Get highest claim product
  const highestClaimProduct = productStats.length > 0
    ? productStats.reduce((max, p) => p.total_claims > max.total_claims ? p : max, productStats[0])
    : null;

  // Show empty state if no data
  if (totalClaims === 0 && !loadingClaims) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <PackageX className="w-16 h-16 text-primary-muted mb-4" />
        <h2 className="text-2xl font-bold text-primary-text mb-2">Henüz İade Verisi Yok</h2>
        <p className="text-primary-muted max-w-md mb-6">
          Trendyol hesabınız bağlı ancak henüz iade kaydı bulunmuyor.
        </p>
        <button
          onClick={onSync}
          disabled={syncing}
          className="btn-primary flex items-center gap-2"
        >
          {syncing ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
          Verileri Senkronize Et
        </button>
      </div>
    );
  }

  return (
    <>
      {profile && <PlanBanner profile={profile} setView={setView} />}

      {/* Quick Summary */}
      {highestClaimProduct && recommendation && (
        <div className="mb-6 bg-status-watch/10 border border-status-watch/30 rounded-lg px-4 py-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-status-watch" />
            <span className="text-sm font-medium text-status-watch">Öne Çıkan</span>
          </div>
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1">
              <p className="text-primary-text">
                <span className="font-medium">{highestClaimProduct.product_name || highestClaimProduct.product_barcode}</span> en çok iade alan ürün
                (<span className="text-status-stop font-semibold">{highestClaimProduct.total_claims} iade</span>)
              </p>
              <p className="text-sm text-primary-muted mt-1">
                Önerilen: {recommendation.title}
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedProductBarcode(highestClaimProduct.product_barcode);
                setView('product-detail');
              }}
              className="px-4 py-2 bg-status-watch text-primary-bg rounded-lg hover:opacity-90 transition-opacity text-sm font-medium whitespace-nowrap"
            >
              Detayları Gör
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 text-sm text-primary-muted mb-6">
        <Clock className="w-4 h-4" />
        Son Güncelleme: {new Date().toLocaleString('tr-TR')}
        <button
          onClick={onSync}
          disabled={syncing}
          className="ml-2 p-1 hover:bg-primary-card rounded transition-colors disabled:opacity-60"
          title="Senkronize Et"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <h2 className="text-2xl font-bold text-primary-text mb-6">Dashboard</h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="card">
          <p className="text-sm text-primary-muted mb-1">Toplam İade</p>
          <p className="text-3xl font-bold text-primary-text">{totalClaims}</p>
          <p className="text-xs text-primary-muted mt-1">{totalQuantity} birim</p>
        </div>
        <div className="card">
          <p className="text-sm text-primary-muted mb-1">İade Nedeni</p>
          <p className="text-3xl font-bold text-primary-cyan">
            {topReason ? topReason.reason.slice(0, 15) + (topReason.reason.length > 15 ? '...' : '') : '-'}
          </p>
          <p className="text-xs text-primary-muted mt-1">En sık sebep</p>
        </div>
        <div className="card">
          <p className="text-sm text-primary-muted mb-1">Etkilenen Ürün</p>
          <p className="text-3xl font-bold text-status-stop">{productStats.length}</p>
          <p className="text-xs text-primary-muted mt-1">Farklı barkod</p>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-primary-text">İade Nedenleri</h3>
        <span className="text-sm text-primary-muted">{reasonSummaries.length} farklı neden</span>
      </div>

      {loadingClaims ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-primary-cyan animate-spin" />
        </div>
      ) : (
        <div className="card mb-6">
          <div className="space-y-3">
            {reasonSummaries.slice(0, 5).map((reason, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-primary-text">{reason.reason}</span>
                  <span className="text-primary-muted">%{reason.percentage.toFixed(1)}</span>
                </div>
                <div className="w-full bg-primary-bg rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-primary-cyan"
                    style={{ width: `${reason.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-primary-text">Ürün Bazlı İadeler</h3>
        <button onClick={() => setView('products')} className="text-sm text-primary-cyan hover:underline">
          Tümünü Gör
        </button>
      </div>

      {loadingClaims ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-primary-cyan animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {productStats.slice(0, planActive ? 6 : 2).map((product, i) => {
            const status = product.total_claims > 10 ? 'stop' : product.total_claims > 5 ? 'watch' : 'go';
            const statusConfig = getStatusConfig(status);
            const StatusIcon = statusConfig.icon;

            return (
              <button
                key={i}
                onClick={() => { setSelectedProductBarcode(product.product_barcode); setView('product-detail'); }}
                className="card hover:border-gray-700 border border-transparent transition-all text-left"
              >
                <div className="flex items-start justify-between mb-4">
                  <h4 className="font-medium text-primary-text pr-2">
                    {product.product_name || product.product_barcode}
                  </h4>
                  <span className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium shrink-0 ${statusConfig.color} ${statusConfig.textColor}`}>
                    <StatusIcon className="w-3 h-3" />
                    {statusConfig.label}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-primary-muted">Toplam İade</span>
                    <span className={`font-semibold ${status === 'stop' ? 'text-status-stop' : status === 'watch' ? 'text-status-watch' : 'text-status-go'}`}>
                      {product.total_claims}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-primary-muted">Toplam Miktar</span>
                    <span className="text-primary-text">{product.total_quantity}</span>
                  </div>
                  {product.last_claim_date && (
                    <div className="flex justify-between items-center pt-2 border-t border-gray-800">
                      <span className="text-sm text-primary-muted">Son İade</span>
                      <span className="text-xs text-primary-muted">
                        {new Date(product.last_claim_date).toLocaleDateString('tr-TR')}
                      </span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}

          {!planActive && productStats.length > 2 && (
            <div className="card flex flex-col items-center justify-center py-8 text-center">
              <Lock className="w-8 h-8 text-primary-muted mb-2" />
              <p className="text-primary-text font-medium">+{productStats.length - 2} ürün daha</p>
              <button onClick={() => setView('settings')} className="text-sm text-primary-cyan hover:underline mt-2">
                Pro'ya geçin
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ─── Products Page ──────────────────────────────────────────────────────────

function ProductsPage({
  productStats,
  loadingProducts,
  setView,
  setSelectedProductBarcode,
  profile,
  trendyolConnected,
}: {
  productStats: ProductClaimStats[];
  loadingProducts: boolean;
  setView: (v: View) => void;
  setSelectedProductBarcode: (barcode: string | null) => void;
  profile: Profile | null;
  trendyolConnected: boolean;
}) {
  const [sortBy, setSortBy] = useState<'claims' | 'quantity' | 'name'>('claims');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [hideStop, setHideStop] = useState(false);

  const planActive = profile ? isPlanActive(profile) : true;

  if (!trendyolConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <LinkIcon className="w-16 h-16 text-primary-muted mb-4" />
        <h2 className="text-2xl font-bold text-primary-text mb-2">Trendyol Bağlı Değil</h2>
        <p className="text-primary-muted max-w-md mb-6">
          Ürün verilerini görmek için Trendyol hesabınızı bağlayın.
        </p>
        <button
          onClick={() => setView('connect-trendyol')}
          className="btn-primary flex items-center gap-2"
        >
          <Link2 className="w-5 h-5" />
          Trendyol Bağla
        </button>
      </div>
    );
  }

  let filteredProducts = hideStop ? productStats.filter((p) => p.total_claims <= 10) : productStats;

  filteredProducts = [...filteredProducts].sort((a, b) => {
    let comparison = 0;
    if (sortBy === 'claims') comparison = a.total_claims - b.total_claims;
    else if (sortBy === 'quantity') comparison = a.total_quantity - b.total_quantity;
    else if (sortBy === 'name') comparison = (a.product_name || a.product_barcode).localeCompare(b.product_name || b.product_barcode, 'tr');
    return sortOrder === 'desc' ? -comparison : comparison;
  });

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-primary-text">Ürünler</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setHideStop(!hideStop)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              hideStop ? 'bg-primary-accent/20 text-primary-accent' : 'bg-primary-card text-primary-muted hover:text-primary-text'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Durdurları Gizle
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-sm text-primary-muted">Sıralama:</span>
        {(['claims', 'quantity', 'name'] as const).map((field) => (
          <button
            key={field}
            onClick={() => {
              if (sortBy === field) setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
              else { setSortBy(field); setSortOrder('desc'); }
            }}
            className={`px-3 py-1.5 rounded text-sm transition-colors ${
              sortBy === field ? 'bg-primary-cyan/20 text-primary-cyan' : 'bg-primary-card text-primary-muted hover:text-primary-text'
            }`}
          >
            {field === 'claims' ? 'İade Sayısı' : field === 'quantity' ? 'Miktar' : 'İsim'}
            {sortBy === field && (sortOrder === 'desc' ? '↓' : '↑')}
          </button>
        ))}
      </div>

      {loadingProducts ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-primary-cyan animate-spin" />
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="card text-center py-12">
          <PackageX className="w-12 h-12 text-primary-muted mx-auto mb-3" />
          <p className="text-primary-muted">Gösterilecek ürün yok</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left py-3 px-4 text-sm font-medium text-primary-muted">Ürün</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-primary-muted">İade Sayısı</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-primary-muted">Toplam Miktar</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-primary-muted">Durum</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => {
                const status = product.total_claims > 10 ? 'stop' : product.total_claims > 5 ? 'watch' : 'go';
                const statusConfig = getStatusConfig(status);
                const StatusIcon = statusConfig.icon;

                return (
                  <tr
                    key={product.id}
                    onClick={() => { setSelectedProductBarcode(product.product_barcode); setView('product-detail'); }}
                    className="border-b border-gray-800/50 hover:bg-primary-bg/50 cursor-pointer transition-colors"
                  >
                    <td className="py-4 px-4">
                      <span className="text-primary-text font-medium">
                        {product.product_name || product.product_barcode}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={`font-semibold ${status === 'stop' ? 'text-status-stop' : status === 'watch' ? 'text-status-watch' : 'text-status-go'}`}>
                        {product.total_claims}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="text-primary-text">{product.total_quantity}</span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${statusConfig.color} ${statusConfig.textColor}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusConfig.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ─── About Page ─────────────────────────────────────────────────────────────

function AboutPage() {
  return (
    <>
      <h2 className="text-2xl font-bold text-primary-text mb-6">Hakkımızda</h2>

      <div className="card mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-primary-cyan/20 rounded-lg">
            <Target className="w-6 h-6 text-primary-cyan" />
          </div>
          <h3 className="text-lg font-semibold text-primary-text">Tek Bir Odak: İade Kaybını Azaltmak</h3>
        </div>
        <p className="text-primary-muted leading-relaxed">
          İadeNabız, Trendyol satıcılarının hangi ürünlerin ne kadar iade aldığını, neden iade aldığını ve bu iadenin onlara ne kadara mal olduğunu gösteren bir analiz aracıdır. Amacımız satıcıların iade kayıplarını azaltmak ve karlılığını artırmaktır.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <Zap className="w-5 h-5 text-status-stop" />
            <h4 className="font-medium text-primary-text">Sorun</h4>
          </div>
          <p className="text-sm text-primary-muted">
            Trendyol'da yüksek iade oranlı ürünler satıcılara büyük finansal kayıplar yaratır. Hangi ürünlerin neden iade edildiğini bilmek zordur.
          </p>
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle className="w-5 h-5 text-status-go" />
            <h4 className="font-medium text-primary-text">Çözüm</h4>
          </div>
          <p className="text-sm text-primary-muted">
            İadeNabız, iade verilerini otomatik olarak çeker, analiz eder ve hangi ürünlerin durdurulması gerektiğini size bildirir.
          </p>
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold text-primary-text mb-4">Özellikler</h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-status-go mt-0.5" />
            <div>
              <p className="text-primary-text font-medium">Otomatik İade Takibi</p>
              <p className="text-sm text-primary-muted">Trendyol API ile anlık iade verisi çekme</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-status-go mt-0.5" />
            <div>
              <p className="text-primary-text font-medium">Kestirimci Analiz</p>
              <p className="text-sm text-primary-muted">Hangi ürünleri durdurmanız gerektiğini otomatik öneri</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-status-go mt-0.5" />
            <div>
              <p className="text-primary-text font-medium">İade Nedeni Analizi</p>
              <p className="text-sm text-primary-muted">Müşteri yorumlarından hangi nedenlerin öne çıktığını görme</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Payment Pages ──────────────────────────────────────────────────────────

function PaymentSuccessPage({ setView }: { setView: (v: View) => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="card max-w-md w-full text-center">
        <div className="p-4 bg-status-go/20 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-status-go" />
        </div>
        <h1 className="text-2xl font-bold text-primary-text mb-2">Ödemeniz Başarıyla Alındı!</h1>
        <p className="text-primary-muted mb-6">
          Hesabınız Pro'ya yükseltildi. Tüm özelliklere erişebilirsiniz.
        </p>
        <button onClick={() => setView('dashboard')} className="btn-primary">
          Dashboard'a Dön
        </button>
      </div>
    </div>
  );
}

function PaymentFailedPage({ setView }: { setView: (v: View) => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="card max-w-md w-full text-center">
        <div className="p-4 bg-status-stop/20 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
          <AlertTriangle className="w-10 h-10 text-status-stop" />
        </div>
        <h1 className="text-2xl font-bold text-primary-text mb-2">Ödeme Tamamlanamadı</h1>
        <p className="text-primary-muted mb-6">
          Ödeme sırasında bir hata oluştu. Lütfen tekrar deneyin.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={() => setView('settings')} className="btn-primary flex-1">Tekrar Dene</button>
          <button onClick={() => setView('dashboard')} className="px-6 py-3 rounded-lg bg-primary-card text-primary-muted hover:text-primary-text transition-colors">
            Dashboard'a Dön
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Early Access Landing Page ──────────────────────────────────────────────

function EarlyAccessPage({ onSignup }: { onSignup: () => void }) {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');

  return (
    <div className="min-h-screen bg-primary-bg flex flex-col">
      {/* Header */}
      <header className="py-6 px-4 border-b border-gray-800/50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Logo />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-2xl w-full text-center">
          {/* Hero */}
          <div className="mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-cyan/10 border border-primary-cyan/30 rounded-full mb-6">
              <Zap className="w-4 h-4 text-primary-cyan" />
              <span className="text-sm font-medium text-primary-cyan">Sınırlı Teklif</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-primary-text mb-4 leading-tight">
              İlk 10 Müşteriye Özel
              <br />
              <span className="text-primary-cyan">Lansman Fiyatı</span>
            </h1>
            <p className="text-lg text-primary-muted max-w-xl mx-auto">
              İadeNabız Pro özelliklerine özel indirimli fiyatlarla erişin.
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid sm:grid-cols-2 gap-4 max-w-lg mx-auto mb-8">
            {/* Monthly */}
            <button
              onClick={() => setSelectedPlan('monthly')}
              className={`p-5 rounded-xl border-2 transition-all text-left ${
                selectedPlan === 'monthly'
                  ? 'border-primary-cyan bg-primary-cyan/5'
                  : 'border-gray-700 hover:border-gray-600 bg-primary-card'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-base font-medium text-primary-text">Aylık</span>
                {selectedPlan === 'monthly' && (
                  <div className="w-5 h-5 rounded-full bg-primary-cyan flex items-center justify-center">
                    <CheckCircle className="w-3 h-3 text-primary-bg" />
                  </div>
                )}
              </div>
              <div className="mb-2">
                <span className="text-2xl font-bold text-primary-text">$20</span>
                <span className="text-primary-muted text-sm">/ay</span>
              </div>
              <p className="text-sm text-primary-muted line-through">Normal: $39/ay</p>
              <div className="mt-3 pt-3 border-t border-gray-700">
                <span className="text-xs font-medium text-status-go">%49 indirim</span>
              </div>
            </button>

            {/* Yearly */}
            <button
              onClick={() => setSelectedPlan('yearly')}
              className={`p-5 rounded-xl border-2 transition-all text-left relative ${
                selectedPlan === 'yearly'
                  ? 'border-primary-cyan bg-primary-cyan/5'
                  : 'border-gray-700 hover:border-gray-600 bg-primary-card'
              }`}
            >
              <div className="absolute -top-3 left-4">
                <span className="px-3 py-1 bg-primary-cyan text-primary-bg text-xs font-bold rounded-full">
                  En İyi Değer
                </span>
              </div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-base font-medium text-primary-text">Yıllık</span>
                {selectedPlan === 'yearly' && (
                  <div className="w-5 h-5 rounded-full bg-primary-cyan flex items-center justify-center">
                    <CheckCircle className="w-3 h-3 text-primary-bg" />
                  </div>
                )}
              </div>
              <div className="mb-2">
                <span className="text-2xl font-bold text-primary-text">$199</span>
                <span className="text-primary-muted text-sm">/yıl</span>
              </div>
              <p className="text-sm text-primary-muted line-through">Normal: $349/yıl</p>
              <div className="mt-3 pt-3 border-t border-gray-700">
                <span className="text-xs font-medium text-status-go">%43 indirim</span>
              </div>
            </button>
          </div>

          {/* Urgency Text */}
          <div className="bg-status-watch/10 border border-status-watch/30 rounded-lg px-4 py-3 mb-8 inline-flex items-center gap-2">
            <Clock className="w-5 h-5 text-status-watch" />
            <span className="text-status-watch font-medium">Sadece ilk 10 kullanıcı için geçerli</span>
          </div>

          {/* CTA Button */}
          <div className="max-w-sm mx-auto">
            <button
              onClick={onSignup}
              className="w-full btn-primary text-lg py-4 flex items-center justify-center gap-2"
            >
              <Crown className="w-5 h-5" />
              Hemen Başla
            </button>
            <p className="text-sm text-primary-muted mt-4">
              7 gün ücretsiz deneme + özel lansman fiyatı
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 px-4 border-t border-gray-800/50">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-sm text-primary-muted">
            © 2024 İadeNabız - Tüm hakları saklıdır.
          </p>
        </div>
      </footer>
    </div>
  );
}

// ─── Settings Page ─────────────────────────────────────────────────────────

function SettingsPage({
  session,
  profile,
  onProfileUpdate,
  trendyolStatus,
  refreshingStatus,
  onRefreshStatus,
  onSync,
  syncing,
}: {
  session: Session;
  profile: Profile | null;
  onProfileUpdate: () => void;
  trendyolStatus: TrendyolStatus | null;
  refreshingStatus: boolean;
  onRefreshStatus: () => void;
  onSync: () => void;
  syncing: boolean;
}) {
  const [showConnectForm, setShowConnectForm] = useState(false);
  const [sellerId, setSellerId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [processingPayment, setProcessingPayment] = useState(false);

  const handleConnect = async () => {
    if (!sellerId || !apiKey || !apiSecret) {
      setError('Tüm alanları doldurun');
      return;
    }

    setConnecting(true);
    setError('');

    const result = await testTrendyolConnection(sellerId, apiKey, apiSecret);

    if (result.success) {
      setSuccess('Trendyol hesabınız başarıyla bağlandı');
      setShowConnectForm(false);
      setSellerId('');
      setApiKey('');
      setApiSecret('');
      onRefreshStatus();
    } else {
      setError(result.error || 'Bağlantı kurulamadı');
    }

    setConnecting(false);
  };

  const handleDisconnect = async () => {
    await disconnectTrendyol();
    onRefreshStatus();
  };

  const handleSubscribe = async () => {
    setProcessingPayment(true);
    setError('');

    // Ensure profile exists before creating payment
    if (!profile) {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (!existingProfile) {
        const { data: newProfile } = await supabase
          .from('profiles')
          .insert({ user_id: session.user.id, email: session.user.email })
          .select()
          .single();
        if (newProfile) onProfileUpdate();
      } else {
        onProfileUpdate();
      }
    }

    const result = await createPaymentLink(selectedPlan);

    if (result.success && result.payment_url) {
      window.open(result.payment_url, '_blank');
    } else {
      setError(result.error || 'Ödeme linki oluşturulamadı');
    }

    setProcessingPayment(false);
  };

  return (
    <>
      <h2 className="text-2xl font-bold text-primary-text mb-6">Ayarlar</h2>

      {success && (
        <div className="mb-6 bg-status-go/10 border border-status-go/30 rounded-lg px-4 py-3">
          <p className="text-status-go">{success}</p>
        </div>
      )}

      {error && (
        <div className="mb-6 bg-status-stop/10 border border-status-stop/30 rounded-lg px-4 py-3">
          <p className="text-status-stop">{error}</p>
        </div>
      )}

      <div className="space-y-6">
        {/* Subscription */}
        <div className="card">
          <h3 className="text-lg font-semibold text-primary-text mb-4 flex items-center gap-2">
            <Crown className="w-5 h-5 text-primary-cyan" />
            Üyelik
          </h3>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 mb-4">
              {/* Free Trial */}
              <div className="p-3 rounded-lg border border-gray-700 bg-primary-bg/50 text-center">
                <p className="text-sm font-medium text-primary-text mb-1">Ücretsiz Deneme</p>
                <p className="text-lg font-bold text-primary-muted">7 gün</p>
                <p className="text-xs text-primary-muted">ücretsiz</p>
              </div>

              {/* Monthly */}
              <button
                onClick={() => setSelectedPlan('monthly')}
                className={`p-3 rounded-lg border-2 transition-all text-center ${
                  selectedPlan === 'monthly' ? 'border-primary-cyan bg-primary-cyan/10' : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <div className="flex items-center justify-center gap-1 mb-1">
                  <span className="text-sm font-medium text-primary-text">Aylık</span>
                  {selectedPlan === 'monthly' && <CheckCircle className="w-4 h-4 text-primary-cyan" />}
                </div>
                <p className="text-lg font-bold text-primary-text">$39</p>
                <p className="text-xs text-primary-muted">/ ay</p>
              </button>

              {/* Yearly */}
              <button
                onClick={() => setSelectedPlan('yearly')}
                className={`p-3 rounded-lg border-2 transition-all text-center relative ${
                  selectedPlan === 'yearly' ? 'border-primary-cyan bg-primary-cyan/10' : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                  <span className="px-2 py-0.5 bg-primary-cyan text-primary-bg text-xs font-bold rounded">En Popüler</span>
                </div>
                <div className="flex items-center justify-center gap-1 mb-1">
                  <span className="text-sm font-medium text-primary-text">Yıllık</span>
                  {selectedPlan === 'yearly' && <CheckCircle className="w-4 h-4 text-primary-cyan" />}
                </div>
                <p className="text-lg font-bold text-primary-text">$349</p>
                <p className="text-xs text-primary-cyan">/ yıl - %25 tasarruf</p>
              </button>
            </div>

            <button
              onClick={handleSubscribe}
              disabled={processingPayment}
              className="w-full btn-primary flex items-center justify-center gap-2"
            >
              {processingPayment ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
              Pro'ya Geç
            </button>
          </div>
        </div>

        {/* Account */}
        <div className="card">
          <h3 className="text-lg font-semibold text-primary-text mb-4">Hesap Bilgileri</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-gray-800">
              <span className="text-primary-muted">E-posta</span>
              <span className="text-primary-text">{session.user.email}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-primary-muted">Hesap Durumu</span>
              <span className="text-status-go text-sm flex items-center gap-1">
                <CheckCircle className="w-4 h-4" /> Aktif
              </span>
            </div>
          </div>
        </div>

        {/* Trendyol Connection */}
        <div className="card">
          <h3 className="text-lg font-semibold text-primary-text mb-4">Trendyol Bağlantısı</h3>

          {refreshingStatus ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-primary-cyan animate-spin" />
            </div>
          ) : trendyolStatus?.connected ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-status-go/10 rounded-lg">
                    <Link2 className="w-6 h-6 text-status-go" />
                  </div>
                  <div>
                    <p className="text-primary-text font-medium">Bağlı</p>
                    <p className="text-sm text-primary-muted">Satıcı ID: {trendyolStatus.seller_id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={onSync}
                    disabled={syncing}
                    className="flex items-center gap-2 px-3 py-2 bg-primary-cyan text-primary-bg rounded-lg hover:opacity-90 transition-opacity text-sm disabled:opacity-60"
                  >
                    {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Senkronize Et
                  </button>
                  <button
                    onClick={handleDisconnect}
                    className="flex items-center gap-2 px-3 py-2 bg-status-stop/20 text-status-stop rounded-lg hover:bg-status-stop/30 transition-colors text-sm"
                  >
                    <Unlink2 className="w-4 h-4" />
                    Bağlantıyı Kaldır
                  </button>
                </div>
              </div>
            </div>
          ) : showConnectForm ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary-muted mb-2">Satıcı ID</label>
                <input
                  type="text"
                  value={sellerId}
                  onChange={(e) => setSellerId(e.target.value)}
                  className="input-field"
                  placeholder="123456"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-muted mb-2">API Key</label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="input-field"
                  placeholder="API anahtarı"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-muted mb-2">API Secret</label>
                <input
                  type="password"
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  className="input-field"
                  placeholder="API secret"
                />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button onClick={handleConnect} disabled={connecting} className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-60">
                  {connecting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Bağlan
                </button>
                <button onClick={() => setShowConnectForm(false)} className="px-4 py-3 rounded-lg bg-primary-card text-primary-muted hover:text-primary-text transition-colors">
                  İptal
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-status-stop/10 rounded-lg">
                  <Link2 className="w-6 h-6 text-status-stop" />
                </div>
                <div>
                  <p className="text-primary-text font-medium">Bağlı Değil</p>
                  <p className="text-sm text-primary-muted">Trendyol API ile bağlantı kurun</p>
                </div>
              </div>
              <button onClick={() => setShowConnectForm(true)} className="flex items-center gap-2 px-4 py-2 bg-primary-accent text-white rounded-lg hover:bg-primary-accent/90 transition-colors">
                <Link2 className="w-4 h-4" />
                Bağlan
              </button>
            </div>
          )}
        </div>

        {/* Privacy */}
        <div className="card">
          <h3 className="text-lg font-semibold text-primary-text mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary-cyan" />
            Gizlilik ve Veri Güvenliği
          </h3>
          <div className="flex items-start gap-3 bg-primary-bg rounded-lg p-4">
            <Lock className="w-5 h-5 text-primary-cyan mt-0.5 shrink-0" />
            <p className="text-sm text-primary-muted">
              Verileriniz güvenle saklanır, üçüncü taraflarla paylaşılmaz. Trendyol API bilgileriniz şifrelenmiş şekilde tutulur ve sadece sizin hesabınızla ilişkilendirilir.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Product Detail Page ────────────────────────────────────────────────────

function ProductDetailPage({
  claims,
  reasonSummaries,
  productBarcode,
  productName,
  setView,
}: {
  claims: Claim[];
  reasonSummaries: ClaimReasonSummary[];
  productBarcode: string | null;
  productName: string | null;
  setView: (v: View) => void;
}) {
  if (!productBarcode) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <PackageX className="w-14 h-14 text-primary-muted mb-4" />
        <p className="text-primary-text font-medium mb-4">Ürün bulunamadı</p>
        <button onClick={() => setView('products')} className="btn-primary max-w-xs">
          Ürünlere Dön
        </button>
      </div>
    );
  }

  const productClaims = claims.filter((c) => c.product_barcode === productBarcode);
  const totalClaims = productClaims.length;
  const totalQuantity = productClaims.reduce((sum, c) => sum + c.quantity, 0);

  const topReason = reasonSummaries.length > 0
    ? reasonSummaries.reduce((max, r) => r.count > max.count ? r : max, reasonSummaries[0])
    : null;
  const recommendation = topReason ? getRecommendation(topReason.reason) : null;

  return (
    <>
      <button onClick={() => setView('products')} className="flex items-center gap-2 text-primary-muted hover:text-primary-text mb-6 transition-colors">
        <ChevronLeft className="w-5 h-5" />
        Ürünlere Dön
      </button>

      <div className="card mb-6">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-primary-text mb-2">
            {productName || productBarcode}
          </h1>
          <p className="text-sm text-primary-muted">Barkod: {productBarcode}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-primary-bg rounded-lg p-4">
            <p className="text-sm text-primary-muted mb-1">Toplam İade</p>
            <p className="text-2xl font-bold text-primary-text">{totalClaims}</p>
          </div>
          <div className="bg-primary-bg rounded-lg p-4">
            <p className="text-sm text-primary-muted mb-1">Toplam Miktar</p>
            <p className="text-2xl font-bold text-primary-text">{totalQuantity}</p>
          </div>
          <div className="bg-primary-bg rounded-lg p-4">
            <p className="text-sm text-primary-muted mb-1">En Sık Neden</p>
            <p className="text-lg font-bold text-primary-cyan">
              {topReason ? topReason.reason.slice(0, 20) : '-'}
            </p>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {recommendation && (
        <div className="card mb-6 bg-status-watch/10 border border-status-watch/30">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-status-watch/20 rounded-lg">
              <Lightbulb className="w-5 h-5 text-status-watch" />
            </div>
            <h3 className="text-lg font-semibold text-primary-text">Yapmanız Gerekenler</h3>
          </div>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <p className="text-primary-text font-medium mb-2">{recommendation.title}</p>
              <p className="text-sm text-primary-muted mb-3">{recommendation.description}</p>
              <p className="text-xs text-status-watch font-medium">{recommendation.stat}</p>
            </div>
            <div className="flex items-center">
              <Zap className="w-12 h-12 text-status-watch/30" />
            </div>
          </div>
        </div>
      )}

      {/* Claims List */}
      <div className="card">
        <h3 className="text-lg font-semibold text-primary-text mb-4">İade Kayıtları</h3>
        {productClaims.length === 0 ? (
          <p className="text-primary-muted text-center py-8">Bu ürün için iade kaydı bulunamadı</p>
        ) : (
          <div className="space-y-3">
            {productClaims.slice(0, 20).map((claim) => (
              <div key={claim.id} className="bg-primary-bg rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-primary-text font-medium">{claim.claim_reason || 'Belirtilmemiş'}</span>
                  <span className="text-sm text-primary-muted">x{claim.quantity}</span>
                </div>
                {claim.customer_note && (
                  <p className="text-sm text-primary-muted">{claim.customer_note}</p>
                )}
                {claim.claim_date && (
                  <p className="text-xs text-primary-muted mt-2">
                    {new Date(claim.claim_date).toLocaleDateString('tr-TR')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ─── App Root ───────────────────────────────────────────────────────────────

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [view, setView] = useState<View>('dashboard');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [trendyolStatus, setTrendyolStatus] = useState<TrendyolStatus | null>(null);
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  const [isEarlyAccessPage, setIsEarlyAccessPage] = useState(false);
  const [supabaseError, setSupabaseError] = useState<string | null>(null);

  const [claims, setClaims] = useState<Claim[]>([]);
  const [reasonSummaries, setReasonSummaries] = useState<ClaimReasonSummary[]>([]);
  const [productStats, setProductStats] = useState<ProductClaimStats[]>([]);
  const [loadingClaims, setLoadingClaims] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [selectedProductBarcode, setSelectedProductBarcode] = useState<string | null>(null);

  // Check for Supabase initialization error on mount
  useEffect(() => {
    const initError = getSupabaseError();
    if (initError) {
      setSupabaseError(`Supabase initialization failed: ${initError}`);
    }
  }, []);

  // Non-blocking session check - runs in background, UI renders immediately
  useEffect(() => {
    // Skip if there's an initialization error
    if (supabaseError) return;

    // Check if we're on the early access page
    if (window.location.pathname === '/erken-erisim') {
      setIsEarlyAccessPage(true);
      return;
    }

    let mounted = true;

    // Try to get session in background - with proper error handling
    try {
      supabase.auth.getSession()
        .then(({ data, error }) => {
          if (!mounted) return;
          if (error) {
            console.error('[App] getSession error:', error.message);
            // Don't block UI, just log and continue as guest
          } else if (data?.session) {
            setSession(data.session);
          }
        })
        .catch((error) => {
          console.error('[App] getSession exception:', error);
          // Continue as guest - UI still renders
        });
    } catch (error) {
      console.error('[App] getSession call failed:', error);
    }

    // Set up auth state listener - wrap in try/catch for safety
    let subscription: { unsubscribe: () => void } | null = null;
    try {
      const result = supabase.auth.onAuthStateChange((_event, newSession) => {
        if (mounted) {
          setSession(newSession);
        }
      });
      subscription = result.data.subscription;
    } catch (error) {
      console.error('[App] onAuthStateChange setup failed:', error);
    }

    return () => {
      mounted = false;
      if (subscription) {
        try {
          subscription.unsubscribe();
        } catch {
          // Ignore cleanup errors
        }
      }
    };
  }, [supabaseError]);

  const fetchProfile = useCallback(async (userId: string, userEmail?: string) => {
    const { data, error } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle();

    if (data) {
      setProfile(data as Profile);
    } else if (error?.code === 'PGRST116' || !data) {
      // Profile doesn't exist, create it
      const email = userEmail || session?.user?.email;
      if (email) {
        const { data: newProfile } = await supabase
          .from('profiles')
          .insert({ user_id: userId, email })
          .select()
          .single();
        if (newProfile) setProfile(newProfile as Profile);
      }
    }
  }, [session?.user?.email]);

  const fetchTrendyolStatus = useCallback(async () => {
    setRefreshingStatus(true);
    const status = await getTrendyolStatus();
    setTrendyolStatus(status);
    setRefreshingStatus(false);
  }, []);

  const fetchClaimsData = useCallback(async () => {
    if (!session?.user?.id) return;

    setLoadingClaims(true);

    const { data: claimsData } = await supabase
      .from('claims')
      .select('*')
      .eq('user_id', session.user.id)
      .order('claim_date', { ascending: false });

    const { data: reasonsData } = await supabase
      .from('claim_reasons_summary')
      .select('*')
      .eq('user_id', session.user.id)
      .order('count', { ascending: false });

    const { data: statsData } = await supabase
      .from('product_claim_stats')
      .select('*')
      .eq('user_id', session.user.id)
      .order('total_claims', { ascending: false });

    if (claimsData) setClaims(claimsData as Claim[]);
    if (reasonsData) setReasonSummaries(reasonsData as ClaimReasonSummary[]);
    if (statsData) setProductStats(statsData as ProductClaimStats[]);

    setLoadingClaims(false);
  }, [session?.user?.id]);

  useEffect(() => {
    if (session?.user?.id) {
      fetchProfile(session.user.id, session.user.email);
      fetchTrendyolStatus();
      fetchClaimsData();
    }
  }, [session, fetchProfile, fetchTrendyolStatus, fetchClaimsData]);

  const handleSync = async () => {
    setSyncing(true);
    await syncTrendyolClaims();
    await fetchClaimsData();
    setSyncing(false);
  };

  const handleConnected = () => {
    fetchTrendyolStatus();
    setView('dashboard');
  };

  const selectedProductName = selectedProductBarcode
    ? productStats.find((p) => p.product_barcode === selectedProductBarcode)?.product_name || null
    : null;

  // Show Supabase error if initialization failed
  if (supabaseError) {
    return (
      <div className="min-h-screen bg-primary-bg flex items-center justify-center p-4">
        <div className="bg-primary-card rounded-xl p-8 max-w-md text-center">
          <AlertTriangle className="w-12 h-12 text-status-stop mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-primary-text mb-2">Connection Error</h1>
          <p className="text-primary-muted text-sm mb-4">{supabaseError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary-cyan text-primary-bg rounded-lg hover:opacity-90 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Render immediately - session loads in background
  if (isEarlyAccessPage) {
    const handleEarlyAccessSignup = () => {
      window.location.href = '/';
    };

    return <EarlyAccessPage onSignup={handleEarlyAccessSignup} />;
  }

  if (!session) {
    return <AuthPage />;
  }

  return (
    <Layout session={session} view={view} setView={setView}>
      {view === 'dashboard' && (
        <DashboardPage
          claims={claims}
          reasonSummaries={reasonSummaries}
          productStats={productStats}
          loadingClaims={loadingClaims}
          setView={setView}
          setSelectedProductBarcode={setSelectedProductBarcode}
          trendyolConnected={trendyolStatus?.connected || false}
          profile={profile}
          onSync={handleSync}
          syncing={syncing}
        />
      )}
      {view === 'products' && (
        <ProductsPage
          productStats={productStats}
          loadingProducts={loadingClaims}
          setView={setView}
          setSelectedProductBarcode={setSelectedProductBarcode}
          profile={profile}
          trendyolConnected={trendyolStatus?.connected || false}
        />
      )}
      {view === 'about' && <AboutPage />}
      {view === 'settings' && (
        <SettingsPage
          session={session}
          profile={profile}
          onProfileUpdate={() => session && fetchProfile(session.user.id, session.user.email)}
          trendyolStatus={trendyolStatus}
          refreshingStatus={refreshingStatus}
          onRefreshStatus={fetchTrendyolStatus}
          onSync={handleSync}
          syncing={syncing}
        />
      )}
      {view === 'connect-trendyol' && <ConnectTrendyolPage onConnected={handleConnected} />}
      {view === 'product-detail' && (
        <ProductDetailPage
          claims={claims}
          reasonSummaries={reasonSummaries}
          productBarcode={selectedProductBarcode}
          productName={selectedProductName}
          setView={setView}
        />
      )}
      {view === 'payment-success' && <PaymentSuccessPage setView={setView} />}
      {view === 'payment-failed' && <PaymentFailedPage setView={setView} />}
    </Layout>
  );
}

export default App;
