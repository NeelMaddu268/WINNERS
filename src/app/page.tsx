'use client';

import Link from 'next/link';
import { useState, useEffect, useRef, ReactNode } from 'react';

const faqs = [
    { q: 'How do I get started?', a: 'Sign up in minutes, verify your identity, fund your account, and start investing right away.' },
    { q: 'What are the fees?', a: 'Zero commission on stocks and ETFs. Competitive rates on options and margin trading.' },
    { q: 'Is my money safe?', a: 'Your assets are protected with bank-level encryption and SIPC insurance up to $500,000.' },
    { q: 'Can I trade crypto?', a: 'Yes. Buy, sell, and hold popular cryptocurrencies 24/7 directly from your account.' },
];

const floatingSymbols = [
    'AAPL', 'TSLA', 'GOOG', 'AMZN', 'MSFT', 'NVDA', 'META', 'BTC',
    '+2.4%', '-1.2%', '+5.7%', '+0.8%', '-3.1%', '+12.3%', '+1.9%',
    '$142.50', '$891.20', '$3,201', '$178.90', '$52.40',
    '▲', '▼', '◆', '●', '■',
    'ETH', 'SPY', 'QQQ', 'VOO', 'DIA',
    '$420.69', '+8.2%', '-0.5%', '$1,847', '+3.6%',
];

const tickerItems = [
    { name: 'Bitcoin', price: '62,699 USD', changes: ['+1.23%', '+2.01%'], positive: true },
    { name: 'Ethereum', price: '3,421 USD', changes: ['+0.87%', '+1.54%'], positive: true },
    { name: 'Apple', price: '189.84 USD', changes: ['+0.42%', '+1.12%'], positive: true },
    { name: 'Tesla', price: '248.50 USD', changes: ['-1.87%', '-2.34%'], positive: false },
    { name: 'Nvidia', price: '875.30 USD', changes: ['+3.21%', '+5.67%'], positive: true },
    { name: 'Amazon', price: '178.25 USD', changes: ['+0.95%', '+1.88%'], positive: true },
    { name: 'Microsoft', price: '415.60 USD', changes: ['-0.32%', '-0.15%'], positive: false },
    { name: 'Google', price: '141.80 USD', changes: ['+1.45%', '+2.30%'], positive: true },
    { name: 'Solana', price: '142.50 USD', changes: ['+4.56%', '+8.12%'], positive: true },
    { name: 'Meta', price: '502.30 USD', changes: ['-0.78%', '-1.23%'], positive: false },
    { name: 'S&P 500', price: '5,234 USD', changes: ['+0.65%', '+1.02%'], positive: true },
    { name: 'Cardano', price: '0.58 USD', changes: ['+2.34%', '+3.89%'], positive: true },
];

function AnimateIn({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
    const ref = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const obs = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) { setVisible(true); obs.unobserve(el); }
        }, { threshold: 0.15 });
        obs.observe(el);
        return () => obs.disconnect();
    }, []);
    return (
        <div ref={ref} className={className} style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(40px)',
            transition: `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s`,
        }}>{children}</div>
    );
}

export default function Home() {
    const [openFaq, setOpenFaq] = useState<number | null>(null);
    const [particles, setParticles] = useState<any[]>([]);

    useEffect(() => {
        setParticles(
            floatingSymbols.map((symbol, i) => ({
                symbol,
                top: `${Math.random() * 90 + 2}%`,
                left: `${Math.random() * 90 + 2}%`,
                size: Math.random() * 0.5 + 0.6,
                opacity: Math.random() * 0.15 + 0.05,
                duration: Math.random() * 20 + 15,
                delay: Math.random() * 10,
                fadeDelay: i * 0.08,
            }))
        );
    }, []);

    return (
        <div className="bg-gradient-to-br from-[#0d1a14] via-[#111c18] to-[#0d1f1a] text-[#f0ede8]">
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-[#4ade9a]/5 rounded-full blur-3xl"></div>
            </div>

            {/* Nav */}
            <nav className="fixed top-0 w-full z-50 bg-[#0d1a14]/80 backdrop-blur-md border-b border-[#2a3d30]/50">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-[#4ade9a] rounded-lg flex items-center justify-center">
                            <span className="text-[#0d1a14] font-bold text-sm">C</span>
                        </div>
                        <span className="font-semibold text-lg tracking-tight">CashMere</span>
                    </div>
                    <Link href="/login" className="px-6 py-2 bg-[#4ade9a] hover:bg-[#22c55e] text-[#0d1a14] rounded-full text-sm font-semibold transition">Continue</Link>
                </div>
            </nav>

            {/* 1. Hero — Floating Symbols */}
            <section className="relative h-screen flex flex-col items-center justify-center overflow-hidden">
                {/* Floating financial symbols background */}
                <div className="absolute inset-0 pointer-events-none">
                    {particles.length > 0 && particles.map((p, i) => (
                        <span
                            key={i}
                            className="absolute font-mono select-none"
                            style={{
                                top: p.top,
                                left: p.left,
                                fontSize: `${p.size}rem`,
                                opacity: 0,
                                color: p.symbol.startsWith('+') || p.symbol === '▲' ? '#4ade9a' :
                                       p.symbol.startsWith('-') || p.symbol === '▼' ? '#f87171' : '#f0ede8',
                                animation: `floatSymbol ${p.duration}s ease-in-out ${p.delay}s infinite, symbolFadeIn 1.5s ease ${p.fadeDelay}s forwards`,
                            }}
                        >
                            {p.symbol}
                        </span>
                    ))}
                </div>

                {/* Radial glow behind headline */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#4ade9a]/5 rounded-full blur-[120px]"></div>

                {/* Hero content */}
                <div className="relative z-10 text-center max-w-4xl mx-auto px-6">
                    <AnimateIn>
                        <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1a2a22]/80 border border-[#2a3d30] rounded-full mb-8 backdrop-blur-sm">
                            <div className="w-2 h-2 bg-[#4ade9a] rounded-full animate-pulse"></div>
                            <span className="text-xs text-[#a8a8a0] font-medium tracking-wide uppercase">Our Capital, Your Success</span>
                        </div>
                    </AnimateIn>
                    <AnimateIn delay={0.15}>
                        <h1 className="text-7xl md:text-8xl lg:text-9xl font-bold mb-6 leading-[0.9] tracking-tight text-white" style={{ fontFamily: 'Playfair Display, serif' }}>
                            Invest with<br />Confidence
                        </h1>
                    </AnimateIn>
                    <AnimateIn delay={0.3}>
                        <p className="text-lg md:text-xl text-[#a8a8a0] mb-12 max-w-2xl mx-auto leading-relaxed">
                            Build wealth with institutional-grade tools, real-time insights, and a platform designed for serious investors.
                        </p>
                    </AnimateIn>
                    <AnimateIn delay={0.45}>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Link href="/login" className="px-8 py-3.5 bg-[#4ade9a] hover:bg-[#22c55e] text-[#0d1a14] rounded-full font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-lg hover:shadow-[#4ade9a]/20">Get Started</Link>
                            <button className="px-8 py-3.5 border border-[#2a3d30] hover:border-[#4ade9a] rounded-full font-semibold transition-all duration-300 flex items-center gap-2 group">
                                Explore <span className="group-hover:translate-x-1 transition">&rarr;</span>
                            </button>
                        </div>
                    </AnimateIn>
                </div>

                {/* Bottom left — Follow Us */}
                <div className="absolute bottom-8 left-8 z-10 flex items-center gap-4" style={{ animation: 'symbolFadeIn 1s ease 1s forwards', opacity: 0 }}>
                    <span className="text-xs text-[#a8a8a0] uppercase tracking-widest">Follow Us</span>
                    <div className="flex items-center gap-3">
                        {['𝕏', 'in', 'f', '▶'].map((icon, i) => (
                            <div key={i} className="w-8 h-8 rounded-full border border-[#2a3d30] flex items-center justify-center text-xs text-[#a8a8a0] hover:border-[#4ade9a] hover:text-[#4ade9a] transition-all duration-300 cursor-pointer">
                                {icon}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Bottom center — Scroll to explore */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2" style={{ animation: 'symbolFadeIn 1s ease 1.2s forwards, gentleBounce 2s ease-in-out 2s infinite', opacity: 0 }}>
                    <span className="text-xs text-[#a8a8a0] uppercase tracking-widest">Scroll to explore</span>
                    <span className="text-[#4ade9a] text-sm">&darr;</span>
                </div>
            </section>

            {/* Scrolling Ticker Bar */}
            <div className="relative border-t border-b border-[#2a3d30]/50 bg-[#0a1410]/90 backdrop-blur-sm overflow-hidden py-3">
                <div className="flex animate-ticker whitespace-nowrap">
                    {[...tickerItems, ...tickerItems, ...tickerItems].map((item, i) => (
                        <div key={i} className="flex items-center gap-3 mx-6 flex-shrink-0">
                            <span className="text-xs font-semibold text-[#f0ede8]">{item.name}</span>
                            <span className="text-xs text-[#a8a8a0]">{item.price}</span>
                            {item.changes.map((c, j) => (
                                <span key={j} className={`text-xs font-mono ${item.positive ? 'text-[#4ade9a]' : 'text-[#b45555]'}`}>{c}</span>
                            ))}
                            <span className="text-[#2a3d30] mx-2">|</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Global Stats Section */}
            <section className="relative py-24 px-6" style={{ background: '#0a1410' }}>
                <div className="max-w-5xl mx-auto">
                    <AnimateIn className="text-center mb-16">
                        <h2 className="text-4xl md:text-5xl font-serif font-bold mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
                            Investors from more than 150 countries<br />trust CashMere
                        </h2>
                        <p className="text-lg text-[#a8a8a0]">Join a global community building wealth together</p>
                    </AnimateIn>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[
                            { value: '$500B', suffix: '+', label: 'Assets Under Management' },
                            { value: '5M', suffix: '+', label: 'Active Investors' },
                            { value: '150', suffix: '+', label: 'Countries Worldwide' },
                            { value: '24/7', suffix: '', label: 'Dedicated Support' },
                        ].map((s, i) => (
                            <AnimateIn key={i} delay={i * 0.12}>
                                <div className="relative p-10 border border-[#2a3d30] rounded-xl bg-[#0d1a14]/50 group hover:border-[#4ade9a]/30 transition-all duration-300">
                                    {/* Top-left corner bracket */}
                                    <div className="absolute top-0 left-0 w-6 h-6">
                                        <div className="absolute top-0 left-0 w-full h-[2px] bg-[#4ade9a]/40 group-hover:bg-[#4ade9a]/70 transition"></div>
                                        <div className="absolute top-0 left-0 h-full w-[2px] bg-[#4ade9a]/40 group-hover:bg-[#4ade9a]/70 transition"></div>
                                    </div>
                                    {/* Bottom-right corner bracket */}
                                    <div className="absolute bottom-0 right-0 w-6 h-6">
                                        <div className="absolute bottom-0 right-0 w-full h-[2px] bg-[#4ade9a]/40 group-hover:bg-[#4ade9a]/70 transition"></div>
                                        <div className="absolute bottom-0 right-0 h-full w-[2px] bg-[#4ade9a]/40 group-hover:bg-[#4ade9a]/70 transition"></div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-5xl md:text-6xl font-bold text-white mb-2">
                                            {s.value}<span className="text-[#4ade9a]">{s.suffix}</span>
                                        </div>
                                        <p className="text-[#a8a8a0] text-sm uppercase tracking-widest">{s.label}</p>
                                    </div>
                                </div>
                            </AnimateIn>
                        ))}
                    </div>
                </div>
            </section>

            {/* 2. Features Grid */}
            <section className="relative py-24 px-6" style={{ background: 'linear-gradient(to bottom, #0d1a14, #111c18)' }}>
                <div className="max-w-7xl mx-auto">
                    <AnimateIn className="text-center mb-16">
                        <h2 className="text-5xl font-serif font-bold mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>Trade Everything</h2>
                        <p className="text-lg text-[#a8a8a0] max-w-2xl mx-auto">Access all major asset classes from one unified platform</p>
                    </AnimateIn>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            { icon: '📈', title: 'Stocks & ETFs', desc: 'Zero commission trading with real-time market data.' },
                            { icon: '₿', title: 'Cryptocurrency', desc: 'Buy, sell, and hold crypto 24/7 securely.' },
                            { icon: '⚡', title: 'Options Trading', desc: 'Advanced strategies with real-time Greeks.' },
                            { icon: '💰', title: 'Margin Trading', desc: 'Competitive rates starting at 3.95%.' },
                        ].map((f, i) => (
                            <AnimateIn key={i} delay={i * 0.1}>
                                <div className="group p-8 bg-[#1a2a22]/50 border border-[#2a3d30] rounded-xl hover:border-[#4ade9a]/50 transition-all duration-300 hover:bg-[#1a2a22]/80 hover:-translate-y-2 hover:shadow-lg hover:shadow-[#4ade9a]/10">
                                    <div className="text-4xl mb-4">{f.icon}</div>
                                    <h3 className="text-xl font-semibold mb-3">{f.title}</h3>
                                    <p className="text-[#a8a8a0] text-sm leading-relaxed">{f.desc}</p>
                                </div>
                            </AnimateIn>
                        ))}
                    </div>
                </div>
            </section>

            {/* 3. AI-Powered Insights */}
            <section className="relative py-24 px-6" style={{ background: '#0f1d17' }}>
                <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                    <AnimateIn>
                        <div>
                            <h2 className="text-5xl font-serif font-bold mb-6" style={{ fontFamily: 'Playfair Display, serif' }}>AI-Powered Insights</h2>
                            <p className="text-[#a8a8a0] mb-8 leading-relaxed">Get personalized market analysis, custom indicators, and smart scans powered by AI.</p>
                            <div className="space-y-4">
                                {['Daily Market Digests', 'Custom Indicators — no coding required', 'Smart Scans — AI monitors markets for you'].map((item, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <div className="w-2 h-2 bg-[#4ade9a] rounded-full flex-shrink-0"></div>
                                        <span>{item}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </AnimateIn>
                    <AnimateIn delay={0.2}>
                        <div className="bg-[#1a2a22] border border-[#2a3d30] rounded-xl p-12 flex items-center justify-center min-h-[300px] hover:border-[#4ade9a]/30 transition-all duration-500">
                            <div className="text-center">
                                <div className="text-7xl mb-4 animate-bounce">🤖</div>
                                <p className="text-[#a8a8a0]">AI Assistant Preview</p>
                            </div>
                        </div>
                    </AnimateIn>
                </div>
            </section>

            {/* 4. Premium Benefits */}
            <section className="relative py-24 px-6" style={{ background: 'linear-gradient(to bottom, #111c18, #0d1a14)' }}>
                <div className="max-w-7xl mx-auto">
                    <AnimateIn className="text-center mb-16">
                        <h2 className="text-5xl font-serif font-bold mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>Premium Benefits</h2>
                        <p className="text-lg text-[#a8a8a0]">Unlock exclusive perks with CashMere</p>
                    </AnimateIn>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            { value: '3.35%', label: 'APY', desc: 'High-yield cash sweep on uninvested funds' },
                            { value: '$50K', label: 'Instant Deposits', desc: 'Get instant access to deposited funds' },
                            { value: '3.95%', label: 'Margin Rate', desc: 'Industry-leading margin interest rates' },
                        ].map((b, i) => (
                            <AnimateIn key={i} delay={i * 0.15}>
                                <div className="text-center p-8 bg-[#1a2a22]/50 border border-[#2a3d30] rounded-xl hover:border-[#4ade9a]/30 transition-all duration-300 hover:-translate-y-1">
                                    <div className="text-4xl font-bold text-[#4ade9a] mb-2">{b.value}</div>
                                    <div className="text-lg font-semibold mb-2">{b.label}</div>
                                    <p className="text-[#a8a8a0] text-sm">{b.desc}</p>
                                </div>
                            </AnimateIn>
                        ))}
                    </div>
                </div>
            </section>

            {/* 5. How to Get Started */}
            <section className="relative py-24 px-6" style={{ background: '#0f1d17' }}>
                <div className="max-w-5xl mx-auto">
                    <AnimateIn className="text-center mb-16">
                        <h2 className="text-5xl font-serif font-bold mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>How to Get Started</h2>
                        <p className="text-lg text-[#a8a8a0]">Start investing in 4 simple steps</p>
                    </AnimateIn>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        {[
                            { step: '01', title: 'Sign Up', desc: 'Create your free account in minutes' },
                            { step: '02', title: 'Verify', desc: 'Quick identity verification' },
                            { step: '03', title: 'Fund', desc: 'Deposit funds instantly' },
                            { step: '04', title: 'Invest', desc: 'Start building your portfolio' },
                        ].map((s, i) => (
                            <AnimateIn key={i} delay={i * 0.12}>
                                <div className="text-center p-6 group">
                                    <div className="text-3xl font-bold text-[#4ade9a] mb-3 group-hover:scale-110 transition-transform duration-300">{s.step}</div>
                                    <h3 className="text-lg font-semibold mb-2">{s.title}</h3>
                                    <p className="text-[#a8a8a0] text-sm">{s.desc}</p>
                                </div>
                            </AnimateIn>
                        ))}
                    </div>
                </div>
            </section>

            {/* 6. Trusted by Millions */}
            <section className="relative py-24 px-6" style={{ background: 'linear-gradient(to bottom, #0d1a14, #111c18)' }}>
                <div className="max-w-5xl mx-auto text-center">
                    <AnimateIn>
                        <h2 className="text-5xl font-serif font-bold mb-16" style={{ fontFamily: 'Playfair Display, serif' }}>Trusted by Millions</h2>
                    </AnimateIn>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                        {[
                            { stat: '5M+', label: 'Active Investors' },
                            { stat: '$500B+', label: 'Assets Under Management' },
                            { stat: '24/7', label: 'Customer Support' },
                        ].map((s, i) => (
                            <AnimateIn key={i} delay={i * 0.15}>
                                <div>
                                    <div className="text-5xl font-bold text-[#4ade9a] mb-2">{s.stat}</div>
                                    <p className="text-[#a8a8a0] text-lg">{s.label}</p>
                                </div>
                            </AnimateIn>
                        ))}
                    </div>
                </div>
            </section>

            {/* 7. Testimonials */}
            <section className="relative py-24 px-6" style={{ background: '#0f1d17' }}>
                <div className="max-w-7xl mx-auto">
                    <AnimateIn className="text-center mb-16">
                        <h2 className="text-5xl font-serif font-bold mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>What Investors Say</h2>
                    </AnimateIn>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            { name: 'Alex M.', text: 'CashMere completely changed how I invest. The AI insights are incredible.' },
                            { name: 'Sarah K.', text: 'Best trading platform I have used. Clean interface and powerful tools.' },
                            { name: 'James R.', text: 'The margin rates are unbeatable. Switched from my old broker in a day.' },
                        ].map((t, i) => (
                            <AnimateIn key={i} delay={i * 0.12}>
                                <div className="p-8 bg-[#1a2a22]/50 border border-[#2a3d30] rounded-xl hover:border-[#4ade9a]/30 transition-all duration-300 hover:-translate-y-1">
                                    <div className="text-[#4ade9a] mb-4">{'★'.repeat(5)}</div>
                                    <p className="text-[#a8a8a0] mb-6 leading-relaxed">{`"${t.text}"`}</p>
                                    <p className="font-semibold">{t.name}</p>
                                </div>
                            </AnimateIn>
                        ))}
                    </div>
                </div>
            </section>

            {/* 8. FAQ */}
            <section className="relative py-24 px-6" style={{ background: 'linear-gradient(to bottom, #111c18, #0d1a14)' }}>
                <div className="max-w-3xl mx-auto">
                    <AnimateIn className="text-center mb-16">
                        <h2 className="text-5xl font-serif font-bold mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>FAQ</h2>
                    </AnimateIn>
                    <div className="space-y-4">
                        {faqs.map((faq, i) => (
                            <AnimateIn key={i} delay={i * 0.08}>
                                <div className="border border-[#2a3d30] rounded-xl overflow-hidden hover:border-[#4ade9a]/30 transition-colors duration-300">
                                    <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full text-left px-6 py-4 flex items-center justify-between hover:bg-[#1a2a22]/50 transition">
                                        <span className="font-semibold">{faq.q}</span>
                                        <span className="text-[#4ade9a] text-xl transition-transform duration-300" style={{ transform: openFaq === i ? 'rotate(45deg)' : 'rotate(0deg)' }}>+</span>
                                    </button>
                                    <div className="overflow-hidden transition-all duration-300" style={{ maxHeight: openFaq === i ? '200px' : '0px', opacity: openFaq === i ? 1 : 0 }}>
                                        <div className="px-6 pb-4 text-[#a8a8a0] text-sm leading-relaxed">{faq.a}</div>
                                    </div>
                                </div>
                            </AnimateIn>
                        ))}
                    </div>
                </div>
            </section>

            {/* 9. Final CTA */}
            <section className="relative py-32 px-6 text-center" style={{ background: '#0f1d17' }}>
                <AnimateIn>
                    <div className="max-w-3xl mx-auto">
                        <h2 className="text-5xl md:text-6xl font-serif font-bold mb-6" style={{ fontFamily: 'Playfair Display, serif' }}>Ready to Transform Your Portfolio?</h2>
                        <p className="text-lg text-[#a8a8a0] mb-10">Join millions of investors building wealth with CashMere.</p>
                        <Link href="/login" className="inline-block px-10 py-4 bg-[#4ade9a] hover:bg-[#22c55e] text-[#0d1a14] rounded-full font-semibold text-lg transition-all duration-300 transform hover:scale-105 hover:shadow-lg hover:shadow-[#4ade9a]/20">Get Started Now</Link>
                    </div>
                </AnimateIn>
            </section>

            {/* Chat bubble */}
            <div className="fixed bottom-8 right-8 w-16 h-16 bg-[#4ade9a] hover:bg-[#22c55e] rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 transform hover:scale-110 shadow-lg shadow-[#4ade9a]/20 z-40 animate-bounce">
                <span className="text-2xl text-[#0d1a14]">💬</span>
            </div>

            <style jsx global>{`
                @keyframes floatSymbol {
                    0%, 100% { transform: translateY(0px) translateX(0px); }
                    25% { transform: translateY(-15px) translateX(8px); }
                    50% { transform: translateY(-5px) translateX(-6px); }
                    75% { transform: translateY(-20px) translateX(4px); }
                }
                @keyframes symbolFadeIn {
                    from { opacity: 0; }
                    to { opacity: var(--target-opacity, 0.12); }
                }
                @keyframes gentleBounce {
                    0%, 100% { transform: translateX(-50%) translateY(0); }
                    50% { transform: translateX(-50%) translateY(-6px); }
                }
                @keyframes ticker {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-33.333%); }
                }
                .animate-ticker {
                    animation: ticker 40s linear infinite;
                }
            `}</style>
        </div>
    );
}
