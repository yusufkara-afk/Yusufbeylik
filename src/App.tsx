import React, { useState, useEffect } from 'react';
import { createClient, Session } from '@supabase/supabase-js';

// Supabase Bağlantısı
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

type View = 'dashboard' | 'products' | 'about' | 'settings';

export default function Root() {
  const [session, setSession] = useState<Session | null>(null);
  const [view, setView] = useState<View>('dashboard');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      setAuthLoading(false);
      if (error) {
        alert('Kayıt Hatası: ' + error.message);
      } else {
        alert('Hesabınız oluşturuldu!');
        setShowAuthModal(false);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setAuthLoading(false);
      if (error) {
        alert('Giriş Hatası: ' + error.message);
      } else {
        setShowAuthModal(false);
      }
    }
  };

  // --- SİTEYE İLK GİREN HERKESE GÖRÜNECEK AÇILIŞ / KARŞILAMA SAYFASI ---
  if (!session) {
    return (
      <div className="min-h-screen bg-[#0f172a] text-slate-100 font-sans selection:bg-blue-500 selection:text-white">
        
        {/* MODAL: GİRİŞ YAP / ÜCRETSİZ BAŞLA */}
        {showAuthModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl relative">
              <button 
                onClick={() => setShowAuthModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white text-xl font-bold"
              >
                ✕
              </button>
              <h3 className="text-2xl font-bold text-white mb-2">
                {isSignUp ? "İadeNabız'a Kayıt Ol" : "İadeNabız'a Giriş Yap"}
              </h3>
              <p className="text-sm text-slate-400 mb-6">
                {isSignUp ? '7 günlük ücretsiz denemenizi başlatmak için hesap oluşturun.' : 'Hesabınıza erişmek için e-posta ve şifrenizi girin.'}
              </p>
              
              <form onSubmit={handleAuth} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300">E-Posta Adresiniz</label>
                  <input 
                    type="email" 
                    required 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ornek@magaza.com"
                    className="w-full mt-1 p-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300">Şifreniz</label>
                  <input 
                    type="password" 
                    required 
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full mt-1 p-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={authLoading}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/25 mt-2"
                >
                  {authLoading ? 'İşleniyor...' : (isSignUp ? 'Ücretsiz Hesabımı Oluştur' : 'Giriş Yap')}
                </button>
              </form>

              <div className="mt-4 text-center">
                <button 
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-xs text-blue-400 hover:underline"
                >
                  {isSignUp ? 'Zaten hesabınız var mı? Giriş yapın.' : 'Hesabınız yok mu? Ücretsiz kayıt olun.'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ÜST MENÜ (NAVBAR) */}
        <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-40">
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/30">
                İ
              </div>
              <span className="font-bold text-xl tracking-tight text-white">İadeNabız</span>
            </div>
            
            <div className="flex items-center gap-4">
              <button 
                onClick={() => { setIsSignUp(false); setShowAuthModal(true); }}
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
              >
                Giriş Yap
              </button>
              <button 
                onClick={() => { setIsSignUp(true); setShowAuthModal(true); }}
                className="px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all shadow-lg shadow-blue-500/20"
              >
                Ücretsiz Başla
              </button>
            </div>
          </div>
        </nav>

        {/* 1. HERO BÖLÜMÜ */}
        <section className="px-4 py-20 text-center max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight mb-6 leading-tight">
            Daha az iade, Daha az sorun, <br /><span className="text-blue-500">Daha fazla kâr.</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-400 mb-8 leading-relaxed max-w-3xl mx-auto">
            İadeNabız, e-ticaret satıcıları için geliştirilen yapay zekâ destekli operasyon platformudur. İadelerin gerçek nedenlerini analiz edin, riskli ürünleri tespit edin ve günlük AI aksiyonlarıyla mağazanızın kârlılığını artırın.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => { setIsSignUp(true); setShowAuthModal(true); }} 
              className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-xl shadow-blue-500/25 text-lg"
            >
              Ücretsiz Başla
            </button>
            <button 
              onClick={() => { setIsSignUp(false); setShowAuthModal(true); }} 
              className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl transition-all border border-slate-700 text-lg"
            >
              Giriş Yap
            </button>
          </div>
        </section>

        {/* 2. İSTATİSTİK BÖLÜMÜ */}
        <section className="px-4 py-16 bg-slate-900/50 border-y border-slate-800">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-12 text-white">Verilerle Yönetin, Tahminlerle Değil.</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="p-6 bg-slate-800/40 rounded-2xl border border-slate-700/80 text-center">
                <div className="text-3xl mb-2">📦</div>
                <h3 className="font-bold text-lg text-white">İade Analizi</h3>
              </div>
              <div className="p-6 bg-slate-800/40 rounded-2xl border border-slate-700/80 text-center">
                <div className="text-3xl mb-2">🤖</div>
                <h3 className="font-bold text-lg text-white">AI Destekli Kararlar</h3>
              </div>
              <div className="p-6 bg-slate-800/40 rounded-2xl border border-slate-700/80 text-center">
                <div className="text-3xl mb-2">⚡</div>
                <h3 className="font-bold text-lg text-white">Kârlılık Takibi</h3>
              </div>
              <div className="p-6 bg-slate-800/40 rounded-2xl border border-slate-700/80 text-center">
                <div className="text-3xl mb-2">📈</div>
                <h3 className="font-bold text-lg text-white">Günlük Operasyon Merkezi</h3>
              </div>
            </div>
          </div>
        </section>

        {/* 3. NEDEN İADENABIZ? */}
        <section className="px-4 py-20 max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-white">İade Oranını Görmek Yetmez. Sebebini Bilmek Gerekir.</h2>
          <p className="text-slate-300 text-lg leading-relaxed mb-6">
            Birçok satıcı yalnızca kaç ürünün iade edildiğini görür. İadeNabız ise bu iadelerin neden gerçekleştiğini analiz eder.
          </p>
        </section>

        {/* 4. ÖZELLİKLER */}
        <section className="px-4 py-16 bg-slate-900/50 border-t border-slate-800">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 text-white">İhtiyacınız Olan Tüm Operasyon Araçları Tek Platformda</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 bg-slate-800/40 rounded-2xl border border-slate-700/70">
                <h3 className="text-xl font-bold mb-2 text-white">🤖 AI Kök Neden Analizi</h3>
                <p className="text-slate-400 text-sm leading-relaxed">İadelerin gerçek sebeplerini yorumlar ve veriler üzerinden çıkarım yapar.</p>
              </div>
              <div className="p-6 bg-slate-800/40 rounded-2xl border border-slate-700/70">
                <h3 className="text-xl font-bold mb-2 text-white">⚠️ Riskli Ürün Analizi</h3>
                <p className="text-slate-400 text-sm leading-relaxed">Kârlılığı düşüren ürünleri tespit ederek erken aksiyon almanızı sağlar.</p>
              </div>
              <div className="p-6 bg-slate-800/40 rounded-2xl border border-slate-700/70">
                <h3 className="text-xl font-bold mb-2 text-white">📊 İade Analizi</h3>
                <p className="text-slate-400 text-sm leading-relaxed">Ürün bazında tüm iade verilerini tek panelden takip edin.</p>
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="border-t border-slate-800 py-8 text-center text-slate-500 text-sm">
          <p>© 2026 İadeNabız. Tüm hakları saklıdır.</p>
        </footer>
      </div>
    );
  }

  // OTURUM AÇILDIĞINDA GÖRÜNECEK PANEL
  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <header className="flex justify-between items-center mb-8 pb-4 border-b border-slate-800">
          <h1 className="text-2xl font-bold">İadeNabız Kontrol Paneli</h1>
          <button 
            onClick={() => supabase.auth.signOut()}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium"
          >
            Çıkış Yap
          </button>
        </header>
        <p className="text-slate-400">Hoş geldiniz! Hesabınız aktif.</p>
      </div>
    </div>
  );
  }
            
