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
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  

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
  
  // --- SİTEYE İLK GİREN HERKESE GÖRÜNECEK AÇILIŞ / KARŞILAMA SAYFASI (LANDING PAGE) ---
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
                
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-xs text-blue-400 hover:underline"
                >
                  {isSignUp ? 'Zaten hesabınız var mı? Giriş yapın.' : 'Hesabınız yok mu? Ücretsiz kayıt olun.'}
                </button>
              </div>
              
            </div>
          </div>
        )}

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
        
                onClick={() => setShowAuthModal(true)}
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
            İadeNabız, e-ticaret satıcıları için geliştirilen yapay zekâ destekli operasyon platformudur. 
            İadelerin gerçek nedenlerini analiz edin, riskli ürünleri tespit edin ve günlük AI aksiyonlarıyla mağazanızın kârlılığını artırın.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => setShowAuthModal(true)} 
              className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-xl shadow-blue-500/25 text-lg"
            >
              Ücretsiz Başla
            </button>
            <button 
              onClick={() => setShowAuthModal(true)} 
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
                <div className="text-3xl mb-2">💰</div>
                <h3 className="font-bold text-lg text-white">Kârlılık Takibi</h3>
              </div>
              <div className="p-6 bg-slate-800/40 rounded-2xl border border-slate-700/80 text-center">
                <div className="text-3xl mb-2">⚡</div>
                <h3 className="font-bold text-lg text-white">Günlük Operasyon Merkezi</h3>
              </div>
            </div>
          </div>
        </section>

        {/* 3. NEDEN İADENABIZ? */}
        <section className="px-4 py-20 max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-white">İade Oranını Görmek Yetmez. Sebebini Bilmek Gerekir.</h2>
          <p className="text-slate-300 text-lg leading-relaxed bg-slate-800/30 p-8 rounded-2xl border border-slate-700/60 shadow-inner">
            Birçok satıcı yalnızca kaç ürünün iade edildiğini görür. İadeNabız ise bu iadelerin neden gerçekleştiğini analiz eder, en riskli ürünleri belirler ve yapay zekâ destekli aksiyonlarla mağazanızın daha kârlı çalışmasına yardımcı olur.
          </p>
        </section>

        {/* 4. ÖZELLİKLER */}
        <section className="px-4 py-16 bg-slate-900/50 border-t border-slate-800">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12 text-white">İhtiyacınız Olan Tüm Operasyon Araçları Tek Platformda</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 bg-slate-800/40 rounded-2xl border border-slate-700/70">
                <h3 className="text-xl font-bold mb-2 text-white">🤖 AI Kök Neden Analizi</h3>
                <p className="text-slate-400 text-sm leading-relaxed">İadelerin gerçek sebeplerini yorumlar ve veriler üzerinden analiz eder.</p>
              </div>
              <div className="p-6 bg-slate-800/40 rounded-2xl border border-slate-700/70">
                <h3 className="text-xl font-bold mb-2 text-white">⚠️ Riskli Ürün Analizi</h3>
                <p className="text-slate-400 text-sm leading-relaxed">Kârlılığı düşüren ürünleri tespit ederek erken aksiyon almanızı sağlar.</p>
              </div>
              <div className="p-6 bg-slate-800/40 rounded-2xl border border-slate-700/70">
                <h3 className="text-xl font-bold mb-2 text-white">💰 Kâr Etki Analizi</h3>
                <p className="text-slate-400 text-sm leading-relaxed">İadelerin mağazanıza olan finansal etkisini TL bazında gösterir.</p>
              </div>
              <div className="p-6 bg-slate-800/40 rounded-2xl border border-slate-700/70">
                <h3 className="text-xl font-bold mb-2 text-white">📊 İade Analizi</h3>
                <p className="text-slate-400 text-sm leading-relaxed">Ürün bazında tüm iade verilerini tek panelden takip edin.</p>
              </div>
              <div className="p-6 bg-slate-800/40 rounded-2xl border border-slate-700/70">
                <h3 className="text-xl font-bold mb-2 text-white">🚦 Durdur • İzle • Devam et</h3>
                <p className="text-slate-400 text-sm leading-relaxed">AI hangi ürünün durdurulması, takip edilmesi veya devam ettirilmesi gerektiğini önerir.</p>
              </div>
              <div className="p-6 bg-slate-800/40 rounded-2xl border border-slate-700/70">
                <h3 className="text-xl font-bold mb-2 text-white">📅 Günlük AI Operasyon Merkezi</h3>
                <p className="text-slate-400 text-sm leading-relaxed">Her gün yapılması gereken en önemli aksiyonları tek ekranda görün.</p>
              </div>
            </div>
          </div>
        </section>

        {/* 5. NASIL ÇALIŞIR? */}
        <section className="px-4 py-20 max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 text-white">3 Adımda Başlayın</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div className="p-6 bg-slate-800/20 rounded-2xl border border-slate-800">
              <div className="w-12 h-12 bg-blue-600 text-white font-black text-xl rounded-full flex items-center justify-center mx-auto mb-4">1</div>
              <h3 className="font-bold text-lg text-white">Mağazanızı bağlayın.</h3>
            </div>
            <div className="p-6 bg-slate-800/20 rounded-2xl border border-slate-800">
              <div className="w-12 h-12 bg-blue-600 text-white font-black text-xl rounded-full flex items-center justify-center mx-auto mb-4">2</div>
              <h3 className="font-bold text-lg text-white">Yapay zekâ tüm iadeleri analiz etsin.</h3>
            </div>
            <div className="p-6 bg-slate-800/20 rounded-2xl border border-slate-800">
              <div className="w-12 h-12 bg-blue-600 text-white font-black text-xl rounded-full flex items-center justify-center mx-auto mb-4">3</div>
              <h3 className="font-bold text-lg text-white">Günlük önerileri uygulayın ve kârlılığınızı artırın.</h3>
            </div>
          </div>
        </section>

        {/* 6. DASHBOARD ÖNİZLEME */}
        <section className="px-4 py-16 bg-slate-900/50 border-t border-slate-800 text-center">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold mb-2 text-white">Tüm Operasyonlarınızı Tek Panelden Yönetin</h2>
            <p className="text-slate-400 mb-8">Kârlılık, iade analizi, AI önerileri ve riskli ürünler tek ekranda.</p>
            <div className="p-6 md:p-8 bg-slate-800/90 rounded-3xl border border-slate-700 shadow-2xl text-left space-y-4">
              <div className="flex justify-between items-center border-b border-slate-700 pb-4">
                <span className="font-bold text-lg text-blue-400">İadeNabız Pro Önizleme</span>
                <span className="text-xs bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/30">● Canlı Veri</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-2">
                <div className="p-3 bg-slate-900/80 rounded-xl">
                  <span className="text-xs text-slate-400">İade Oranı</span>
                  <p className="text-xl font-bold text-white">%3.2</p>
                </div>
                <div className="p-3 bg-slate-900/80 rounded-xl">
                  <span className="text-xs text-slate-400">Tasarruf Etkisi</span>
                  <p className="text-xl font-bold text-emerald-400">₺14,250</p>
                </div>
                <div className="p-3 bg-slate-900/80 rounded-xl">
                  <span className="text-xs text-slate-400">Riskli Ürünler</span>
                  <p className="text-xl font-bold text-amber-400">2 Ürün</p>
                </div>
                <div className="p-3 bg-slate-900/80 rounded-xl">
                  <span className="text-xs text-slate-400">AI Aksiyonu</span>
                  <p className="text-xl font-bold text-purple-400">Hazır</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 7. FİYATLANDIRMA */}
        <section className="px-4 py-20 max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-12 text-white">Basit ve Şeffaf Fiyatlandırma</h2>
          <div className="max-w-md mx-auto p-8 bg-slate-800/80 rounded-3xl border-2 border-blue-500 shadow-2xl relative">
            <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wide">Sınırsız Erişim</span>
            <h3 className="text-2xl font-bold mb-2 text-white">İadeNabız Pro</h3>
            <div className="text-4xl font-extrabold my-4 text-white">999₺ <span className="text-base font-normal text-slate-400">/ Ay</span></div>
            <ul className="text-left space-y-3 mb-8 text-slate-300 text-sm">
              <li className="flex items-center gap-2"><span className="text-emerald-400 font-bold">✓</span> 7 Gün Ücretsiz Deneme</li>
              <li className="flex items-center gap-2"><span className="text-emerald-400 font-bold">✓</span> AI Kök Neden Analizi</li>
              <li className="flex items-center gap-2"><span className="text-emerald-400 font-bold">✓</span> AI Operasyon Merkezi</li>
              <li className="flex items-center gap-2"><span className="text-emerald-400 font-bold">✓</span> Riskli Ürün Analizi</li>
              <li className="flex items-center gap-2"><span className="text-emerald-400 font-bold">✓</span> İade Analizi</li>
              <li className="flex items-center gap-2"><span className="text-emerald-400 font-bold">✓</span> Kâr Etki Analizi</li>
              <li className="flex items-center gap-2"><span className="text-emerald-400 font-bold">✓</span> Haftalık AI Raporları</li>
            </ul>
            <button 
              onClick={() => setShowAuthModal(true)} 
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 font-bold text-white rounded-xl transition-all shadow-lg shadow-blue-500/20"
            >
              Hemen Başla
            </button>
          </div>
        </section>

        {/* 8. SSS */}
        <section className="px-4 py-16 bg-slate-900/50 border-t border-slate-800">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-10 text-white">Sıkça Sorulan Sorular (SSS)</h2>
            <div className="space-y-4">
              {[
                { q: 'İadeNabız hangi pazaryerlerini destekliyor?', a: 'Şu anda Trendyol ve Shopify pazaryerlerini destekliyor.' },
                { q: 'Ücretsiz deneme var mı?', a: 'Evet. Kayıt olan her kullanıcı otomatik olarak 7 günlük ücretsiz deneme hakkı kazanır.' },
                { q: 'Verilerim güvende mi?', a: 'Evet. Verileriniz güvenli şekilde saklanır ve üçüncü kişilerle paylaşılmaz.' },
                { q: 'İadeNabız iadeleri otomatik yönetiyor mu?', a: 'Hayır. İadeNabız\'ın amacı iadeleri yönetmek değil, iadelerin nedenlerini analiz ederek daha az iade almanıza yardımcı olmaktır.' },
                { q: 'Kimler için uygundur?', a: 'Trendyol ve Shopify üzerinden satış yapan, mağazasını veri odaklı yönetmek isteyen e-ticaret satıcıları için geliştirilmiştir.' }
              ].map((faq, idx) => (
                <div key={idx} className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden">
                  <button 
                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                    className="w-full p-4 text-left font-semibold flex justify-between items-center text-slate-200"
                  >
                    <span>{faq.q}</span>
                    <span className="text-blue-400 text-lg">{openFaq === idx ? '−' : '+'}</span>
                  </button>
                  {openFaq === idx && (
                    <div className="p-4 pt-0 text-slate-400 text-sm border-t border-slate-700/30">
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 9. FOOTER */}
        <footer className="border-t border-slate-800 bg-slate-950 px-4 py-12 text-slate-400 text-sm">
          <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="font-bold text-white mb-3">Ürün</h4>
              <ul className="space-y-2 text-xs">
                <li>Ana Sayfa</li>
                <li>Özellikler</li>
                <li>Fiyatlandırma</li>
                <li>SSS</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-3">Şirket</h4>
              <ul className="space-y-2 text-xs">
                <li>Hakkımızda</li>
                <li>İletişim</li>
                <li>Blog</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-3">Yasal</h4>
              <ul className="space-y-2 text-xs">
                <li>Gizlilik Politikası</li>
                <li>Kullanım Şartları</li>
                <li>KVKK</li>
                <li>Çerez Politikası</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-3">İletişim</h4>
              <ul className="space-y-2 text-xs">
                <li>LinkedIn</li>
                <li>E-posta</li>
              </ul>
            </div>
          </div>
          <div className="text-center pt-8 border-t border-slate-900 text-xs text-slate-500">
            © 2026 İadeNabız. Tüm hakları saklıdır.
          </div>
        </footer>
      </div>
    );
  }

    // --- KULLANICI GİRİŞ YAPTIYSA GÖRÜNECEK YÖNETİM PANELİ ---
  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 flex flex-col font-sans">
      <header className="border-b border-slate-800 bg-slate-900/80 px-4 py-3 flex justify-between items-center">
        <span className="font-black text-xl text-blue-500">İadeNabız Panel</span>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-slate-400 truncate max-w-[150px]">{session.user.email}</span>
          <button 
            onClick={() => supabase.auth.signOut()}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700 font-medium"
          >
            Çıkış Yap
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sol Menü */}
        <aside className="w-64 bg-slate-900/50 border-r border-slate-800 p-4 space-y-1 hidden md:block">
          <button onClick={() => setView('dashboard')} className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-semibold ${view === 'dashboard' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>📊 Dashboard</button>
          <button onClick={() => setView('products')} className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-semibold ${view === 'products' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>📦 Ürünler & İadeler</button>
          <button onClick={() => setView('about')} className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-semibold ${view === 'about' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>❓ SSS & Destek</button>
          <button onClick={() => setView('settings')} className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-semibold ${view === 'settings' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>⚙️ Ayarlar</button>
        </aside>

        {/* Ana İçerik */}
        <main className="flex-1 p-6">
          {view === 'dashboard' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 bg-slate-800/40 rounded-2xl border border-slate-700">
                  <span className="text-xs text-slate-400 font-semibold uppercase">Toplam İade</span>
                  <p className="text-3xl font-extrabold text-white mt-1">0</p>
                </div>
                <div className="p-5 bg-slate-800/40 rounded-2xl border border-slate-700">
                  <span className="text-xs text-slate-400 font-semibold uppercase">AI Durumu</span>
                  <p className="text-sm font-medium text-emerald-400 mt-2">● Aktif ve Çalışıyor</p>
                </div>
                <div className="p-5 bg-slate-800/40 rounded-2xl border border-slate-700">
                  <span className="text-xs text-slate-400 font-semibold uppercase">Paket</span>
                  <p className="text-sm font-medium text-blue-400 mt-2">7 Gün Ücretsiz Deneme</p>
                </div>
              </div>
            </div>
          )}

          {view === 'products' && (
            <div className="p-6 bg-slate-800/40 rounded-2xl border border-slate-700">
              <h2 className="text-xl font-bold mb-2">Ürünler & İadeler</h2>
              <p className="text-slate-400 text-sm">Takip edilen iade talepleriniz burada sergilenecektir.</p>
            </div>
          )}

          {view === 'about' && (
            <div className="p-6 bg-slate-800/40 rounded-2xl border border-slate-700">
              <h2 className="text-xl font-bold mb-2">Sıkça Sorulan Sorular</h2>
              <p className="text-slate-400 text-sm">Destek ekibimizle iletişime geçebilirsiniz.</p>
            </div>
          )}

          {view === 'settings' && (
            <div className="p-6 bg-slate-800/40 rounded-2xl border border-slate-700">
              <h2 className="text-xl font-bold mb-2">Ayarlar</h2>
              <p className="text-slate-400 text-sm">Hesap: {session.user.email}</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}


