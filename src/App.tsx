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
import { supabase } from './lib/supabase';
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
  // 1. Session kontrolü
  let session;
  try {
    const sessionResult = await supabase.auth.getSession();
    if (sessionResult.error) {
      console.error('[createPaymentLink] getSession error:', sessionResult.error);
      return { success: false, error: `Oturum bilgisi alınamadı: ${sessionResult.error.message}` };
    }
    session = sessionResult.data.session;
  } catch (err) {
    console.error('[createPaymentLink] getSession threw:', err);
    return { success: false, error: 'Oturum bilgisi alınırken beklenmeyen bir hata oluştu' };
  }

  if (!session) {
    return { success: false, error: 'Oturum bulunamadı, lütfen tekrar giriş yapın' };
  }

  // 2. Supabase URL'sinin build-time'da tanımlı olduğunu doğrula
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    console.error('[createPaymentLink] VITE_SUPABASE_URL is not defined at build time');
    return {
      success: false,
      error: 'Yapılandırma hatası: VITE_SUPABASE_URL tanımlı değil (deployment ortam değişkenlerini kontrol edin)',
    };
  }

  const functionUrl = `${supabaseUrl}/functions/v1/paytr-payment`;

  // 3. Fetch isteği — ağ hatası, CORS hatası burada yakalanır
  let response: Response;
  try {
    response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ plan }),
    });
  } catch (err) {
    console.error('[createPaymentLink] fetch threw (network/CORS):', err, 'URL:', functionUrl);
    return {
      success: false,
      error: `Sunucuya ulaşılamadı (ağ/CORS hatası). URL: ${functionUrl} — Edge Function deploy edilmiş mi kontrol edin.`,
    };
  }

  // 4. Ham response body'yi önce text olarak oku (JSON parse patlamasın diye)
  let rawText: string;
  try {
    rawText = await response.text();
  } catch (err) {
    console.error('[createPaymentLink] response.text() threw:', err);
    return { success: false, error: 'Sunucu yanıtı okunamadı' };
  }

  // 5. HTML dönüyorsa (yanlış URL / 404 sayfası / SPA fallback) net şekilde yakala
  const looksLikeHtml = rawText.trim().startsWith('<');
  if (looksLikeHtml) {
    console.error(
      '[createPaymentLink] Response is HTML, not JSON. Status:', response.status,
      'URL:', functionUrl,
      'Body (first 300 chars):', rawText.slice(0, 300)
    );
    return {
      success: false,
      error: `Sunucu JSON yerine HTML döndürdü (status ${response.status}). Bu genelde Edge Function'ın bu URL'de deploy edilmediği anlamına gelir: ${functionUrl}`,
    };
  }

  // 6. JSON parse
  let data: { success?: boolean; payment_url?: string; error?: string };
  try {
    data = JSON.parse(rawText);
  } catch (err) {
    console.error('[createPaymentLink] JSON.parse failed. Status:', response.status, 'Body:', rawText.slice(0, 300));
    return {
      success: false,
      error: `Sunucu yanıtı geçerli JSON değil (status ${response.status}): ${rawText.slice(0, 150)}`,
    };
  }

  // 7. HTTP status başarısızsa (400/401/404/500 vb.) ama JSON parse edilebildiyse
  if (!response.ok) {
    console.error('[createPaymentLink] Non-OK response:', response.status, data);
    return {
      success: false,
      error: data.error || `Sunucu hatası (status ${response.status})`,
    };
  }

  // 8. Başarılı ama beklenen alan eksikse
  if (!data.success || !data.payment_url) {
    console.error('[createPaymentLink] Response missing success/payment_url:', data);
    return {
      success: false,
      error: data.error || 'Ödeme linki sunucudan alınamadı (payment_url eksik)',
    };
  }

  return { success: true, payment_url: data.payment_url };
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
                    <button
                      onClick={handleSignOut}
                      className="w-full text-left px-4 py-3 text-sm text-status-stop hover:bg-status-stop/10 transition-colors border-t border-gray-700"
                    >
                      Çıkış Yap
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function Root() {
  const [session, setSession] = useState<Session | null>(null);
  const [view, setView] = useState<View>('dashboard');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user) {
      supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setProfile(data);
        });

      supabase
        .from('claims')
        .select('*')
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          if (data) setClaims(data);
        });
    }
  }, [session]);

  if (!session) {
    return <AuthPage />;
  }

      return (
    <Layout session={session} view={view} setView={setView}>
      {view === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card">
              <h3 className="text-sm font-medium text-primary-muted">Toplam İade Talebi</h3>
              <p className="text-2xl font-bold text-primary-text mt-1">{claims.length}</p>
            </div>
            <div className="card">
              <h3 className="text-sm font-medium text-primary-muted">Kullanıcı E-Posta</h3>
              <p className="text-base font-medium text-primary-text mt-1 truncate">{session.user.email}</p>
            </div>
            <div className="card">
              <h3 className="text-sm font-medium text-primary-muted">Sistem Durumu</h3>
              <p className="text-base font-medium text-status-go mt-1">Aktif & Çalışıyor</p>
            </div>
          </div>

          <div className="card">
            <h2 className="text-xl font-bold text-primary-text mb-4">İadeNabız Yönetim Paneli</h2>
            {claims.length === 0 ? (
              <p className="text-primary-muted">Henüz kayıtlı bir iade talebi bulunmuyor.</p>
            ) : (
              <div className="space-y-2">
                {claims.map((claim, index) => (
                  <div key={index} className="p-3 bg-primary-bg rounded-lg border border-gray-700 flex justify-between items-center">
                    <span className="text-sm text-primary-text font-medium">{claim.title || 'İade Talebi'}</span>
                    <span className="text-xs text-primary-muted">{claim.status || 'Beklemede'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'products' && (
        <div className="card">
          <h2 className="text-xl font-bold text-primary-text mb-4">Ürünler & İadeler</h2>
          <p className="text-primary-muted">Takip edilen ürün listeniz burada sergilenecektir.</p>
        </div>
      )}

      {view === 'settings' && (
        <div className="card">
          <h2 className="text-xl font-bold text-primary-text mb-4">Hesap Ayarları</h2>
          <p className="text-primary-muted">E-posta: {session.user.email}</p>
        </div>
      )}

      {view === 'about' && (
        <div className="card">
          <h2 className="text-xl font-bold text-primary-text mb-4">Hakkında</h2>
          <p className="text-primary-muted">İadeNabız v1.0 - Otomatik İade Takip Sistemi</p>
        </div>
      )}
    </Layout>
  );
              }


