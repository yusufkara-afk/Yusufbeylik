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
        alert('Hesabınız oluşturuldu! E-postanızı doğrulayabilir veya giriş yapabilirsiniz.');
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

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
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
        <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40">
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/30">
                İ
              </div>
              <span className="font-bold text-xl tracking-tight text-white">İadeNabız</span>
            </div>

            <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
              <a href="#ozellikler" className="hover:text-white transition-colors">Özellikler</a>
              <a href="#fiyatlandirma" className="hover:text-white transition-colors">Fiyatlandırma</a>
              <a href="#sss" className="hover:text-white transition-colors">SSS</a>
            </div>
            
            <div className="flex items-center gap-3">
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

        {/* 2. İSTATİSTİK / ÖZET BÖLÜMÜ */}
        <section className="px-4 py-16 bg-slate-900/50 border-y border-slate-800">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-12 text-white">Verilerle Yönetin, Tahminlerle Değil.</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="p-6 bg-slate-800/40 rounded-2xl border border-slate-700/80 text-center">
                <div className="text-3xl mb-2">📦</div>
                <h3 className="font-bold text-lg text-white mb-1">İade Analizi</h3>
                <p className="text-xs text-slate-400">Ürün ve kategori bazlı iade oranlarını anında görüntüleyin.</p>
              </div>
              <div className="p-6 bg-slate-800/40 rounded-2xl border border-slate-700/80 text-center">
                <div className="text-3xl mb-2">🤖</div>
                <h3 className="font-bold text-lg text-white mb-1">AI Destekli Kararlar</h3>
                <p className="text-xs text-slate-400">Müşteri yorumlarından iade nedenlerini otomatik çıkarın.</p>
              </div>
              <div className="p-6 bg-slate-800/40 rounded-2xl border border-slate-700/80 text-center">
                <div className="text-3xl mb-2">⚡</div>
                <h3 className="font-bold text-lg text-white mb-1">Kârlılık Takibi</h3>
                <p className="text-xs text-slate-400">İadelerin cironuza ve kâr marjınıza net etkisini hesaplayın.</p>
              </div>
              <div className="p-6 bg-slate-800/40 rounded-2xl border border-slate-700/80 text-center">
                <div className="text-3xl mb-2">📈</div>
                <h3 className="font-bold text-lg text-white mb-1">Günlük Operasyon</h3>
                <p className="text-xs text-slate-400">Her gün hangi ürünleri revize etmeniz gerektiğini öğrenin.</p>
              </div>
            </div>
          </div>
        </section>

        {/* 3. NEDEN İADENABIZ? */}
        <section className="px-4 py-20 max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-white">İade Oranını Görmek Yetmez. Sebebini Bilmek Gerekir.</h2>
          <p className="text-slate-300 text-lg leading-relaxed mb-6">
            Birçok satıcı yalnızca kaç ürünün iade edildiğini görür. İadeNabız ise bu iadelerin neden gerçekleştiğini analiz eder. Beden uyumsuzluğu mu, açıklama hatası mı yoksa paketleme sorunu mu? Yapay zekâmız kök nedeni belirler ve çözüm üretir.
          </p>
        </section>

        {/* 4. TÜM ÖZELLİKLER BÖLÜMÜ */}
        <section id="ozellikler" className="px-4 py-16 bg-slate-900/50 border-t border-slate-800">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 text-white">İhtiyacınız Olan Tüm Operasyon Araçları Tek Platformda</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 bg-slate-800/40 rounded-2xl border border-slate-700/70">
                <h3 className="text-xl font-bold mb-2 text-white">🤖 AI Kök Neden Analizi</h3>
                <p className="text-slate-400 text-sm leading-relaxed">İadelerin gerçek sebeplerini yorumlar ve veriler üzerinden otomatik çıkarım yapar.</p>
              </div>
              <div className="p-6 bg-slate-800/40 rounded-2xl border border-slate-700/70">
                <h3 className="text-xl font-bold mb-2 text-white">⚠️ Riskli Ürün Analizi</h3>
                <p className="text-slate-400 text-sm leading-relaxed">Kârlılığı düşüren ve iade oranı yüksek ürünleri tespit ederek erken aksiyon almanızı sağlar.</p>
              </div>
              <div className="p-6 bg-slate-800/40 rounded-2xl border border-slate-700/70">
                <h3 className="text-xl font-bold mb-2 text-white">📊 Kâr Etki Analizi</h3>
                <p className="text-slate-400 text-sm leading-relaxed">İadelerin mağazanıza olan finansal etkisini TL bazında net olarak gösterir.</p>
              </div>
              <div className="p-6 bg-slate-800/40 rounded-2xl border border-slate-700/70">
                <h3 className="text-xl font-bold mb-2 text-white">📈 İade Trend Takibi</h3>
                <p className="text-slate-400 text-sm leading-relaxed">Dönemsel ve kategori bazlı iade artışlarını zaman çizelgesinde analiz edin.</p>
              </div>
              <div className="p-6 bg-slate-800/40 rounded-2xl border border-slate-700/70">
                <h3 className="text-xl font-bold mb-2 text-white">🎯 Günlük Aksiyon Listesi</h3>
                <p className="text-slate-400 text-sm leading-relaxed">Yapay zeka her sabah öncelikli güncellemeniz gereken ürün bilgilerini listeler.</p>
              </div>
              <div className="p-6 bg-slate-800/40 rounded-2xl border border-slate-700/70">
                <h3 className="text-xl font-bold mb-2 text-white">📑 Otomatik Raporlama</h3>
                <p className="text-slate-400 text-sm leading-relaxed">Haftalık ve aylık iade performans raporlarını PDF/Excel olarak tek tıkla indirin.</p>
              </div>
            </div>
          </div>
        </section>

        {/* 5. ÖDEME VE FİYATLANDIRMA BÖLÜMÜ */}
        <section id="fiyatlandirma" className="px-4 py-20 max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Esnek ve Şeffaf Fiyatlandırma</h2>
            <p className="text-slate-400">Mağazanızın ölçeğine uygun paketi seçin, iade maliyetlerinizi hemen düşürmeye başlayın.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Başlangıç Paketi */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 flex flex-col justify-between hover:border-slate-700 transition-all">
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Başlangıç</h3>
                <p className="text-slate-400 text-sm mb-6">Yeni başlayan e-ticaret mağazaları için.</p>
                <div className="mb-6">
                  <span className="text-4xl font-black text-white">₺499</span>
                  <span className="text-slate-400 text-sm"> / ay</span>
                </div>
                <ul className="space-y-3 text-sm text-slate-300 mb-8">
                  <li className="flex items-center gap-2">✓ 1.000 Sipariş/Ay Takibi</li>
                  <li className="flex items-center gap-2">✓ Temel İade Analizi</li>
                  <li className="flex items-center gap-2">✓ AI Kök Neden Analizi</li>
                  <li className="flex items-center gap-2">✓ E-Posta Desteği</li>
                </ul>
              </div>
              <button 
                onClick={() => { setIsSignUp(true); setShowAuthModal(true); }}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all border border-slate-700"
              >
                7 Gün Ücretsiz Deneyin
              </button>
            </div>

            {/* Pro Paketi (Öne Çıkan) */}
            <div className="bg-gradient-to-b from-blue-950/80 to-slate-900 border-2 border-blue-500 rounded-3xl p-8 flex flex-col justify-between relative shadow-2xl shadow-blue-500/10">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wider">
                En Popüler
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Pro</h3>
                <p className="text-slate-400 text-sm mb-6">Büyümekte olan ve yüksek hacimli satıcılar için.</p>
                <div className="mb-6">
                  <span className="text-4xl font-black text-white">₺999</span>
                  <span className="text-slate-400 text-sm"> / ay</span>
                </div>
                <ul className="space-y-3 text-sm text-slate-200 mb-8">
                  <li className="flex items-center gap-2">✓ 10.000 Sipariş/Ay Takibi</li>
                  <li className="flex items-center gap-2">✓ Gelişmiş AI Kök Neden Analizi</li>
                  <li className="flex items-center gap-2">✓ Riskli Ürün Erken Uyarı Sistemi</li>
                  <li className="flex items-center gap-2">✓ Günlük AI Aksiyon Tavsiyeleri</li>
                  <li className="flex items-center gap-2">✓ Öncelikli Canlı Destek</li>
                </ul>
              </div>
              <button 
                onClick={() => { setIsSignUp(true); setShowAuthModal(true); }}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/25"
              >
                Pro Planı Başlat
              </button>
            </div>

            {/* Kurumsal Paketi */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 flex flex-col justify-between hover:border-slate-700 transition-all">
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Kurumsal</h3>
                <p className="text-slate-400 text-sm mb-6">Çoklu mağaza ve büyük markalar için özel çözümler.</p>
                <div className="mb-6">
                  <span className="text-4xl font-black text-white">Özel</span>
                </div>
                <ul className="space-y-3 text-sm text-slate-300 mb-8">
                  <li className="flex items-center gap-2">✓ Sınırsız Sipariş Takibi</li>
                  <li className="flex items-center gap-2">✓ Özel API Entegrasyonları</li>
                  <li className="flex items-center gap-2">✓ Çoklu Mağaza Yönetimi</li>
                  <li className="flex items-center gap-2">✓ Müşteri Temsilcisi (7/24)</li>
                </ul>
              </div>
              <button 
                onClick={() => { setIsSignUp(true); setShowAuthModal(true); }}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all border border-slate-700"
              >
                İletişime Geçin
              </button>
            </div>
          </div>
        </section>

        {/* 6. SSS (SIKÇA SORULAN SORULAR) BÖLÜMÜ */}
        <section id="sss" className="px-4 py-20 bg-slate-900/50 border-t border-slate-800">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-12">Sıkça Sorulan Sorular</h2>
            <div className="space-y-4">
              {[
                {
                  q: "İadeNabız mağazama nasıl entegre olur?",
                  a: "Pazaryeri mağazanıza API anahtarları aracılığıyla sadece birkaç dakika içinde güvenle bağlanır. Herhangi bir kodlama bilgisine ihtiyacınız yoktur."
                },
                {
                  q: "Ücretsiz deneme süresince kredi kartı gerekli mi?",
                  a: "Hayır! 7 günlük ücretsiz denemenizi kart bilgisi girmeden anında başlatabilirsiniz."
                },
                {
                  q: "AI kök neden analizi nasıl çalışır?",
                  a: "İadeNabız yapay zekası, müşterilerin bıraktığı iade yorumlarını ve görselleri tarayarak problemin ürün açıklamasından mı, kalıptan mı yoksa kargodan mı kaynaklandığını tespit eder."
                },
                {
                  q: "Verilerim güvende mi?",
                  a: "Evet, tüm verileriniz Supabase ve yüksek güvenlikli uçtan uca şifrelemeli sunucularda saklanır. Verileriniz 3. şahıslarla asla  paylaşılamaz."
                }
              ].map((faq, idx) => (
                <div key={idx} className="bg-slate-800/50 border border-slate-700/80 rounded-2xl overflow-hidden">
                  <button 
                    onClick={() => toggleFaq(idx)}
                    className="w-full text-left p-5 flex justify-between items-center font-semibold text-white hover:bg-slate-800/80 transition-colors"
                  >
                    <span>{faq.q}</span>
                    <span className="text-xl font-bold text-blue-400">{openFaq === idx ? '−' : '+'}</span>
                  </button>
                  {openFaq === idx && (
                    <div className="p-5 pt-0 text-slate-400 text-sm leading-relaxed border-t border-slate-700/50">
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="border-t border-slate-800 py-12 bg-slate-950 text-slate-400 text-sm">
          <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-xs">
                İ
              </div>
              <span className="font-bold text-lg text-white">İadeNabız</span>
            </div>
            <p>© 2026 İadeNabız. Tüm hakları saklıdır.</p>
            <div className="flex gap-6">
              <a href="#ozellikler" className="hover:text-white transition-colors">Özellikler</a>
              <a href="#fiyatlandirma" className="hover:text-white transition-colors">Fiyatlandırma</a>
              <a href="#sss" className="hover:text-white transition-colors">SSS</a>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  // OTURUM AÇILDIĞINDA GÖRÜNECEK PANEL (KONTROL PANELİ)
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* PANEL NAVBAR */}
      <header className="border-b border-slate-800 bg-slate-900/90 px-6 py-4 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white">
              İ
            </div>
            <span className="font-bold text-xl text-white">İadeNabız</span>
          </div>
          <nav className="hidden md:flex items-center gap-4 text-sm font-medium">
            <button onClick={() => setView('dashboard')} className={`px-3 py-1.5 rounded-lg transition-colors ${view === 'dashboard' ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:text-white'}`}>
              Genel Bakış
            </button>
            <button onClick={() => setView('products')} className={`px-3 py-1.5 rounded-lg transition-colors ${view === 'products' ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:text-white'}`}>
              Riskli Ürünler
            </button>
            <button onClick={() => setView('about')} className={`px-3 py-1.5 rounded-lg transition-colors ${view === 'about' ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:text-white'}`}>
              AI Aksiyonları
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-400 hidden sm:inline">{session.user.email}</span>
          <button 
            onClick={() => supabase.auth.signOut()}
            className="px-4 py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-xl text-xs font-semibold transition-all"
          >
            Çıkış Yap
          </button>
        </div>
      </header>

      {/* PANEL İÇERİĞİ */}
      <main className="p-6 max-w-6xl mx-auto w-full flex-1">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white">Hoş Geldiniz 👋</h2>
          <p className="text-slate-400 text-sm">Mağazanızın iade durumu ve yapay zeka tavsiyeleri aktif.</p>
        </div>

        {/* METRİK KARTLARI */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
            <span className="text-slate-400 text-xs font-semibold">Bu Ayki İade Sayısı</span>
            <div className="text-2xl font-bold text-white mt-1">142 Adet</div>
            <span className="text-emerald-400 text-xs mt-2 block">↓ %12 Geçen aya göre</span>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
            <span className="text-slate-400 text-xs font-semibold">Genel İade Oranı</span>
            <div className="text-2xl font-bold text-white mt-1">%4.2</div>
            <span className="text-slate-400 text-xs mt-2 block">Sektör Ortalaması: %6.5</span>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
            <span className="text-slate-400 text-xs font-semibold">Tahmini Kâr Kaybı</span>
            <div className="text-2xl font-bold text-rose-400 mt-1">₺18,450</div>
            <span className="text-rose-400 text-xs mt-2 block">Lojistik ve Yeniden İşleme</span>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
            <span className="text-slate-400 text-xs font-semibold">AI Aksiyon Bekleyen</span>
            <div className="text-2xl font-bold text-blue-400 mt-1">3 Ürün</div>
            <span className="text-blue-400 text-xs mt-2 block">Acil revizyon öneriliyor</span>
          </div>
        </div>

        {/* TABLO */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">Erken Uyarı: En Yüksek İade Riski Olan Ürünler</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="text-xs text-slate-400 uppercase bg-slate-800/50 border-b border-slate-800">
                <tr>
                  <th className="p-3">Ürün Adı</th>
                  <th className="p-3">İade Oranı</th>
                  <th className="p-3">Ana Sebeb (AI)</th>
                  <th className="p-3">Önerilen Aksiyon</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                <tr>
                  <td className="p-3 font-medium text-white">Oversize Siyah Sweatshirt</td>
                  <td className="p-3 text-rose-400 font-bold">%14.8</td>
                  <td className="p-3">Beden Çok Büyük Geliyor</td>
                  <td className="p-3 text-blue-400">Beden tablosunu güncelleyin</td>
                </tr>
                <tr>
                  <td className="p-3 font-medium text-white">Kablosuz Bluetooth Kulaklık</td>
                  <td className="p-3 text-amber-400 font-bold">%9.2</td>
                  <td className="p-3">Eşleşme Kılavuzu Eksik</td>
                  <td className="p-3 text-blue-400">Kutuya QR kılavuz ekleyin</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
        }
          
