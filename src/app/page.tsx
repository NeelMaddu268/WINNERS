'use client';

import Link from 'next/link';
import { useState, useEffect, useRef, ReactNode } from 'react';
import { getTickerData } from './actions/ticker';

const faqs = [
    { q: 'How does the AI generate stock insights?', a: 'Cashmere leverages Google\'s Gemini 2.0 model to analyze real-time market data, company news, and financial statements to provide high-velocity intelligence on any ticker.' },
    { q: 'Where does the market data come from?', a: 'We integrate with professional-grade financial APIs like Yahoo Finance to bring you real-time prices, historical charts, and sector-wide performance data.' },
    { q: 'What is "High-Velocity Discovery"?', a: 'It\'s our intelligent screening tool that instantly highlights top gainers, losers, and high-volume movers, allowing you to identify market opportunities the second they happen.' },
    { q: 'What is the Fear & Greed Index?', a: 'It\'s a sentiment engine that processes market momentum, volatility, and breadth to help you gauge whether the market is currently in a state of panic or extreme greed.' },
];

const floatingSymbols = [
    'AAPL', 'TSLA', 'GOOG', 'AMZN', 'MSFT', 'NVDA', 'META', 'BTC',
    '+2.4%', '-1.2%', '+5.7%', '+0.8%', '-3.1%', '+12.3%', '+1.9%',
    '$142.50', '$891.20', '$3,201', '$178.90', '$52.40',
    '▲', '▼', '◆', '●', '■',
    'ETH', 'SPY', 'QQQ', 'VOO', 'DIA',
    '$420.69', '+8.2%', '-0.5%', '$1,847', '+3.6%',
];

const defaultTickerItems = [
    { name: 'Bitcoin', price: '—', change: '—', positive: true },
    { name: 'Ethereum', price: '—', change: '—', positive: true },
    { name: 'Apple', price: '—', change: '—', positive: true },
    { name: 'Tesla', price: '—', change: '—', positive: true },
    { name: 'Nvidia', price: '—', change: '—', positive: true },
    { name: 'Amazon', price: '—', change: '—', positive: true },
    { name: 'Microsoft', price: '—', change: '—', positive: true },
    { name: 'Google', price: '—', change: '—', positive: true },
    { name: 'Solana', price: '—', change: '—', positive: true },
    { name: 'Meta', price: '—', change: '—', positive: true },
    { name: 'S&P 500', price: '—', change: '—', positive: true },
    { name: 'Cardano', price: '—', change: '—', positive: true },
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

function CountUp({ target, suffix = '', prefix = '' }: { target: number; suffix?: string; prefix?: string }) {
    const ref = useRef<HTMLSpanElement>(null);
    const [val, setVal] = useState(0);
    const [started, setStarted] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const obs = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting && !started) { setStarted(true); obs.unobserve(el); }
        }, { threshold: 0.5 });
        obs.observe(el);
        return () => obs.disconnect();
    }, [started]);
    useEffect(() => {
        if (!started) return;
        const duration = 2000;
        const start = performance.now();
        const tick = (now: number) => {
            const t = Math.min((now - start) / duration, 1);
            const ease = 1 - Math.pow(1 - t, 3);
            setVal(Math.round(ease * target));
            if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }, [started, target]);
    return <span ref={ref}>{prefix}{val.toLocaleString()}{suffix}</span>;
}

export default function Home() {
    const [openFaqs, setOpenFaqs] = useState<number[]>([]);

    const toggleFaq = (idx: number) => {
        setOpenFaqs(prev =>
            prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
        );
    };
    const [activeStep, setActiveStep] = useState(0);
    const [cycleWord, setCycleWord] = useState(0);
    const cycleWords = ['freedom', 'confidence', 'success', 'wealth', 'growth'];
    const [showContent, setShowContent] = useState(false);
    const [animationPhase, setAnimationPhase] = useState<'initial' | 'letters' | 'complete'>('initial');

    useEffect(() => {
        const interval = setInterval(() => {
            setCycleWord(prev => (prev + 1) % 5);
        }, 2200);
        return () => clearInterval(interval);
    }, []);

    // Initial animation sequence - letters slide in from left to right
    useEffect(() => {
        const timer1 = setTimeout(() => {
            setAnimationPhase('letters');
        }, 300); // Start letters immediately after a short delay

        const timer2 = setTimeout(() => {
            setAnimationPhase('complete');
        }, 1200); // Complete letter animation faster

        const timer3 = setTimeout(() => {
            setShowContent(true);
        }, 2000); // Show full content after 2 seconds total

        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
            clearTimeout(timer3);
        };
    }, []);
    const [particles, setParticles] = useState<any[]>([]);
    const [tickerItems, setTickerItems] = useState(defaultTickerItems);
    const glowRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        let animId: number;
        let mouseX = 0, mouseY = 0, glowX = 0, glowY = 0;
        const onMove = (e: MouseEvent) => {
            mouseX = e.clientX; mouseY = e.clientY;
        };
        window.addEventListener('mousemove', onMove);
        const lerp = () => {
            glowX += (mouseX - glowX) * 0.08;
            glowY += (mouseY - glowY) * 0.08;
            if (glowRef.current) {
                glowRef.current.style.transform = `translate(${glowX - 225}px, ${glowY - 225}px)`;
            }
            animId = requestAnimationFrame(lerp);
        };
        animId = requestAnimationFrame(lerp);
        return () => { window.removeEventListener('mousemove', onMove); cancelAnimationFrame(animId); };
    }, []);



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

    useEffect(() => {
        getTickerData().then((data) => setTickerItems(data)).catch(() => { });
    }, []);

    // Particle star field
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        let animId: number;
        const resize = () => { canvas.width = window.innerWidth; canvas.height = document.documentElement.scrollHeight; };
        resize();
        window.addEventListener('resize', resize);
        const stars = Array.from({ length: 120 }, () => ({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            r: Math.random() * 1.2 + 0.5,
            dx: (Math.random() - 0.5) * 0.15,
            dy: -(Math.random() * 0.2 + 0.05),
            o: Math.random() * 0.2 + 0.08,
            green: Math.random() > 0.6,
        }));
        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (const s of stars) {
                s.x += s.dx; s.y += s.dy;
                if (s.y < 0) s.y = canvas.height;
                if (s.x < 0) s.x = canvas.width;
                if (s.x > canvas.width) s.x = 0;
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
                ctx.fillStyle = s.green ? `rgba(74,222,154,${s.o})` : `rgba(240,237,232,${s.o})`;
                ctx.fill();
            }
            animId = requestAnimationFrame(draw);
        };
        animId = requestAnimationFrame(draw);
        return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
    }, []);

    return (
        <div className="bg-gradient-to-br from-[#0d1a14] via-[#111c18] to-[#0d1f1a] text-[#f0ede8] relative">
            {/* Initial Cashmere display with sliding letters */}
            {!showContent && (
                <div className="fixed inset-0 flex items-center justify-center z-50 bg-gradient-to-br from-[#0d1a14] via-[#111c18] to-[#0d1f1a]">
                    <div className="text-center px-8 py-16">
                        <div className="relative">
                            <div className="flex items-center justify-center text-7xl md:text-8xl font-black tracking-tight text-white" style={{ textShadow: '0 0 30px #4ade9a, 0 0 60px rgba(74,222,154,0.4), 0 0 90px rgba(74,222,154,0.2)' }}>
                                <span
                                    className={`inline-block transition-all duration-500 ease-out ${animationPhase === 'initial'
                                        ? 'transform -translate-x-full opacity-0'
                                        : 'transform translate-x-0 opacity-100'
                                        }`}
                                    style={{ transitionDelay: '0ms' }}
                                >
                                    C
                                </span>
                                <span
                                    className={`inline-block transition-all duration-500 ease-out ${animationPhase === 'initial'
                                        ? 'transform -translate-x-full opacity-0'
                                        : 'transform translate-x-0 opacity-100'
                                        }`}
                                    style={{ transitionDelay: '80ms' }}
                                >
                                    a
                                </span>
                                <span
                                    className={`inline-block transition-all duration-500 ease-out ${animationPhase === 'initial'
                                        ? 'transform -translate-x-full opacity-0'
                                        : 'transform translate-x-0 opacity-100'
                                        }`}
                                    style={{ transitionDelay: '160ms' }}
                                >
                                    s
                                </span>
                                <span
                                    className={`inline-block transition-all duration-500 ease-out ${animationPhase === 'initial'
                                        ? 'transform -translate-x-full opacity-0'
                                        : 'transform translate-x-0 opacity-100'
                                        }`}
                                    style={{ transitionDelay: '240ms' }}
                                >
                                    h
                                </span>
                                <span
                                    className={`inline-block transition-all duration-500 ease-out text-[#4ade9a] ${animationPhase === 'initial'
                                        ? 'transform -translate-x-full opacity-0'
                                        : 'transform translate-x-0 opacity-100'
                                        }`}
                                    style={{
                                        transitionDelay: '320ms',
                                        textShadow: '0 0 40px #4ade9a, 0 0 80px rgba(74,222,154,0.6), 0 0 120px rgba(74,222,154,0.3)'
                                    }}
                                >
                                    M
                                </span>
                                <span
                                    className={`inline-block transition-all duration-500 ease-out ${animationPhase === 'initial'
                                        ? 'transform -translate-x-full opacity-0'
                                        : 'transform translate-x-0 opacity-100'
                                        }`}
                                    style={{ transitionDelay: '400ms' }}
                                >
                                    e
                                </span>
                                <span
                                    className={`inline-block transition-all duration-500 ease-out ${animationPhase === 'initial'
                                        ? 'transform -translate-x-full opacity-0'
                                        : 'transform translate-x-0 opacity-100'
                                        }`}
                                    style={{ transitionDelay: '480ms' }}
                                >
                                    r
                                </span>
                                <span
                                    className={`inline-block transition-all duration-500 ease-out ${animationPhase === 'initial'
                                        ? 'transform -translate-x-full opacity-0'
                                        : 'transform translate-x-0 opacity-100'
                                        }`}
                                    style={{ transitionDelay: '560ms' }}
                                >
                                    e
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Particle star field canvas */}
            <canvas ref={canvasRef} className={`fixed inset-0 w-full h-full pointer-events-none z-0 transition-opacity duration-1000 ${showContent ? 'opacity-100' : 'opacity-0'}`} />
            {/* Cursor glow */}
            <div ref={glowRef} className={`fixed top-0 left-0 w-[450px] h-[450px] pointer-events-none z-0 rounded-full transition-opacity duration-1000 ${showContent ? 'opacity-100' : 'opacity-0'}`} style={{ background: 'radial-gradient(circle, rgba(74,222,154,0.05) 0%, transparent 70%)', filter: 'blur(40px)' }}></div>

            <div className={`fixed inset-0 pointer-events-none z-0 transition-opacity duration-1000 ${showContent ? 'opacity-100' : 'opacity-0'}`}>
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-[#4ade9a]/5 rounded-full blur-3xl"></div>
            </div>

            {/* Nav */}
            <nav className={`fixed top-0 w-full z-50 bg-[#0d1a14]/80 backdrop-blur-md border-b border-[#2a3d30]/50 transition-all duration-1000 ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-[#4ade9a] rounded-lg flex items-center justify-center">
                            <span className="text-[#0d1a14] font-bold text-sm">C</span>
                        </div>
                        <span className="font-semibold text-lg tracking-tight">Cashmere</span>
                    </div>
                    <Link href="/login" className={`px-6 py-2 bg-[#4ade9a] hover:bg-[#22c55e] text-[#0d1a14] rounded-full text-sm font-semibold transition animate-btnPulse duration-1000 cursor-pointer ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>Continue</Link>
                </div>
            </nav>

            {/* 1. Hero — Floating Symbols */}
            <section className="relative h-screen flex flex-col items-center justify-center overflow-hidden">
                {/* Floating financial symbols background */}
                <div className={`absolute inset-0 pointer-events-none transition-opacity duration-1000 ${showContent ? 'opacity-100' : 'opacity-0'}`}>
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
                                animation: showContent ? `floatSymbol ${p.duration}s ease-in-out ${p.delay}s infinite, symbolFadeIn 1.5s ease ${p.fadeDelay}s forwards` : 'none',
                            }}
                        >
                            {p.symbol}
                        </span>
                    ))}

                    {/* Additional floating elements */}
                    {showContent && ['💰', '📈', '🚀', '💎', '⚡', '🎯'].map((emoji, i) => (
                        <span
                            key={`emoji-${i}`}
                            className="absolute select-none text-2xl opacity-20"
                            style={{
                                top: `${20 + (i * 15) % 60}%`,
                                left: `${15 + (i * 20) % 70}%`,
                                animation: `floatSymbol ${12 + (i % 3) * 3}s ease-in-out ${i * 1.2}s infinite, symbolFadeIn 2s ease ${i * 0.3 + 1}s forwards`,
                            }}
                        >
                            {emoji}
                        </span>
                    ))}
                </div>

                {/* Radial glow behind headline */}
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#4ade9a]/5 rounded-full blur-[120px] transition-opacity duration-1000 ${showContent ? 'opacity-100' : 'opacity-0'}`}></div>

                {/* Hero content */}
                <div className={`relative z-10 text-center max-w-4xl mx-auto px-6 transition-all duration-1000 ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    {showContent && (
                        <>
                            <AnimateIn>
                                <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1a2a22]/80 border border-[#2a3d30] rounded-full mb-8 backdrop-blur-sm">
                                    <div className="w-2 h-2 bg-[#4ade9a] rounded-full animate-pulse"></div>
                                    <span className="text-xs text-[#a8a8a0] font-medium tracking-wide uppercase">Our Capital, Your Success</span>
                                </div>
                            </AnimateIn>
                            <AnimateIn delay={0.15}>
                                <h1 className="text-7xl md:text-8xl lg:text-9xl font-black mb-6 leading-[0.9] tracking-tight text-white" style={{ textShadow: '0 0 40px #4ade9a, 0 0 80px rgba(74,222,154,0.35), 0 0 120px rgba(74,222,154,0.15)' }}>
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
                                    <Link href="/login" className="px-8 py-3.5 bg-[#4ade9a] hover:bg-[#22c55e] text-[#0d1a14] rounded-full font-semibold transition-all duration-300 transform hover:scale-105 animate-btnPulse cursor-pointer">Get Started</Link>
                                    <button onClick={() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })} className="w-12 h-12 border border-[#2a3d30] hover:border-[#4ade9a] rounded-full font-semibold transition-all duration-300 flex items-center justify-center group hover:bg-[#4ade9a]/10 cursor-pointer">
                                        <span className="text-lg group-hover:translate-y-1 transition">&darr;</span>
                                    </button>
                                </div>
                            </AnimateIn>
                        </>
                    )}
                </div>


                {/* Bottom center — Scroll to explore */}
                <div className={`absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 transition-all duration-1000 ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                    <span className="text-xs text-[#a8a8a0] uppercase tracking-widest">Scroll to explore</span>
                    <span className="text-[#4ade9a] text-sm">&darr;</span>
                </div>
            </section>

            {/* Scrolling Ticker Bar */}
            <div className={`relative border-t border-b border-[#2a3d30]/50 bg-[#0a1410]/90 backdrop-blur-sm overflow-hidden py-3 transition-all duration-1000 ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                <div className="flex animate-ticker whitespace-nowrap">
                    {[...tickerItems, ...tickerItems, ...tickerItems].map((item, i) => (
                        <div key={i} className="flex items-center gap-3 mx-6 flex-shrink-0">
                            <span className="text-xs font-semibold text-[#f0ede8]">{item.name}</span>
                            <span className="text-xs text-[#a8a8a0]">{item.price}</span>
                            <span className={`text-xs font-mono ${item.positive ? 'text-[#4ade9a]' : 'text-[#b45555]'}`}>{item.change}</span>
                            <span className="text-[#2a3d30] mx-2">|</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Animated fluid wave divider */}
            <div className="relative w-full h-24 overflow-hidden" style={{ background: 'linear-gradient(to bottom, #0a1410, #0a1410)' }}>
                <svg className="absolute bottom-0 w-[200%] h-full animate-wave1" viewBox="0 0 1440 100" preserveAspectRatio="none">
                    <path d="M0,60 C360,20 720,90 1080,40 C1260,20 1380,50 1440,60 L1440,100 L0,100Z" fill="rgba(74,222,154,0.05)" />
                </svg>
                <svg className="absolute bottom-0 w-[200%] h-full animate-wave2" viewBox="0 0 1440 100" preserveAspectRatio="none">
                    <path d="M0,70 C240,30 480,80 720,50 C960,20 1200,70 1440,40 L1440,100 L0,100Z" fill="rgba(74,222,154,0.08)" />
                </svg>
                <svg className="absolute bottom-0 w-[200%] h-full animate-wave3" viewBox="0 0 1440 100" preserveAspectRatio="none">
                    <path d="M0,50 C180,80 540,20 900,60 C1080,80 1260,30 1440,50 L1440,100 L0,100Z" fill="rgba(74,222,154,0.12)" />
                </svg>
            </div>

            {/* Global Stats Section */}
            <section className="relative py-24 px-6" style={{ background: '#0a1410' }}>
                <div className="max-w-5xl mx-auto">
                    <AnimateIn className="text-center mb-16">
                        <h2 className="text-4xl md:text-5xl font-serif font-bold mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
                            The numbers behind<br />Cashmere
                        </h2>
                        <p className="text-lg text-[#a8a8a0]">Built for investors who want more from their platform</p>
                    </AnimateIn>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[
                            { value: '12', suffix: '+', label: 'Live Market Indices Tracked' },
                            { value: '10s', suffix: '', label: 'Real-Time Price Refresh Rate' },
                            { value: '50', suffix: '+', label: 'Stocks, Crypto & ETFs Available' },
                            { value: '24/7', suffix: '', label: 'AI Portfolio Analysis' },
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

            {/* What is Cashmere — Two Column */}
            <section className="relative py-28 px-6" style={{ background: 'linear-gradient(to bottom, #0d1a14, #0f1d17)' }}>
                <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
                    {/* Left — Large heading with geometric wireframe */}
                    <AnimateIn>
                        <div className="relative flex items-center justify-center min-h-[400px]">
                            {/* Animated wireframe SVG */}
                            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">
                                {/* Connecting lines */}
                                <line x1="80" y1="80" x2="200" y2="50" stroke="#4ade9a" strokeOpacity="0.15" strokeWidth="1" className="animate-pulse" />
                                <line x1="200" y1="50" x2="320" y2="100" stroke="#4ade9a" strokeOpacity="0.12" strokeWidth="1" className="animate-pulse" />
                                <line x1="320" y1="100" x2="350" y2="220" stroke="#4ade9a" strokeOpacity="0.15" strokeWidth="1" className="animate-pulse" />
                                <line x1="350" y1="220" x2="300" y2="330" stroke="#4ade9a" strokeOpacity="0.1" strokeWidth="1" className="animate-pulse" />
                                <line x1="300" y1="330" x2="180" y2="360" stroke="#4ade9a" strokeOpacity="0.15" strokeWidth="1" className="animate-pulse" />
                                <line x1="180" y1="360" x2="60" y2="300" stroke="#4ade9a" strokeOpacity="0.12" strokeWidth="1" className="animate-pulse" />
                                <line x1="60" y1="300" x2="80" y2="80" stroke="#4ade9a" strokeOpacity="0.1" strokeWidth="1" className="animate-pulse" />
                                <line x1="200" y1="50" x2="200" y2="200" stroke="#4ade9a" strokeOpacity="0.08" strokeWidth="1" />
                                <line x1="80" y1="80" x2="200" y2="200" stroke="#4ade9a" strokeOpacity="0.08" strokeWidth="1" />
                                <line x1="320" y1="100" x2="200" y2="200" stroke="#4ade9a" strokeOpacity="0.08" strokeWidth="1" />
                                <line x1="350" y1="220" x2="200" y2="200" stroke="#4ade9a" strokeOpacity="0.08" strokeWidth="1" />
                                <line x1="60" y1="300" x2="200" y2="200" stroke="#4ade9a" strokeOpacity="0.08" strokeWidth="1" />
                                <line x1="180" y1="360" x2="200" y2="200" stroke="#4ade9a" strokeOpacity="0.08" strokeWidth="1" />
                                {/* Glowing nodes */}
                                {[[200, 200], [80, 80], [200, 50], [320, 100], [350, 220], [300, 330], [180, 360], [60, 300]].map(([cx, cy], i) => (
                                    <g key={i}>
                                        <circle cx={cx} cy={cy} r="6" fill="#4ade9a" fillOpacity="0.08" className="animate-pulse" />
                                        <circle cx={cx} cy={cy} r="3" fill="#4ade9a" fillOpacity={i === 0 ? 0.6 : 0.25} className="animate-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
                                    </g>
                                ))}
                            </svg>
                            {/* Heading overlay */}
                            <div className="relative z-10 text-center md:text-left">
                                <h2 className="text-6xl md:text-7xl font-bold leading-[0.95] text-white" style={{ fontFamily: 'Playfair Display, serif' }}>
                                    Our Capital<br /><span className="text-[#4ade9a]">Your Success</span>
                                </h2>
                            </div>
                        </div>
                    </AnimateIn>

                    {/* Right — Description */}
                    <AnimateIn delay={0.2}>
                        <div>
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#1a2a22]/80 border border-[#2a3d30] rounded-full mb-6">
                                <div className="w-2 h-2 bg-[#4ade9a] rounded-full animate-pulse"></div>
                                <span className="text-xs text-[#a8a8a0] font-medium uppercase tracking-wide">What is Cashmere?</span>
                            </div>
                            <h3 className="text-2xl md:text-3xl font-bold mb-6 text-white leading-snug">
                                Trade on any market with institutional-grade capital
                            </h3>
                            <div className="space-y-4 text-[#a8a8a0] leading-relaxed">
                                <p>
                                    Cashmere gives you access to the same tools and capital that hedge funds and institutional traders use — without the barriers. Whether you trade stocks, crypto, or options, our platform levels the playing field.
                                </p>
                                <p>
                                    With AI-driven insights, real-time analytics, and zero-commission trading, you can make smarter decisions faster. Our technology processes millions of data points so you don't have to.
                                </p>
                                <p>
                                    Join a global community of investors who trust Cashmere to grow their wealth with confidence, transparency, and cutting-edge infrastructure.
                                </p>
                            </div>
                        </div>
                    </AnimateIn>
                </div>
            </section>

            {/* 2. Why Choose Cashmere */}
            <section className="relative py-28 px-6 overflow-hidden" style={{ background: 'linear-gradient(to bottom, #0d1a14, #111c18)' }}>
                {/* Cinematic watermark */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                    <span className="text-[180px] md:text-[240px] font-black text-white/[0.03] leading-none tracking-tighter">TRADE</span>
                </div>
                <div className="max-w-6xl mx-auto">
                    <AnimateIn className="text-center mb-16">
                        <h2 className="text-5xl md:text-6xl font-serif font-bold mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>Why choose Cashmere?</h2>
                        <p className="text-lg text-[#a8a8a0] max-w-2xl mx-auto">Everything you need to trade smarter, faster, and with confidence</p>
                    </AnimateIn>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[
                            { icon: '📊', title: 'Live Portfolio Tracking', desc: 'Monitor all your positions with real-time prices from Yahoo Finance. See your total value, unrealized P&L, average cost basis, and available cash — updated every 10 seconds so you never miss a move.' },
                            { icon: '🤖', title: 'AI Portfolio Insights', desc: 'Get an AI-generated Portfolio Pulse with scores for growth potential, overvaluation risk, and political climate impact. Plus personalized lookout alerts when opportunities or risks emerge in your holdings.' },
                            { icon: '👥', title: 'Social Trading Feed', desc: 'See what your friends are buying and selling in real time. Like, comment, and follow other investors. View their top holdings and track their moves — investing is better when you do it together.' },
                            { icon: '🔍', title: 'Full Market Intelligence', desc: 'Live indices, top gainers and losers, volume leaders, sector heatmaps, Fear & Greed index, earnings calendars, and economic events — all in one place with a powerful ticker search.' },
                        ].map((card, i) => (
                            <AnimateIn key={i} delay={i * 0.12}>
                                <div className="relative group p-10 bg-[#1a2a22] border border-[#2a3d30] rounded-xl hover:border-[#4ade9a] transition-all duration-400 hover:shadow-lg hover:shadow-[#4ade9a]/10 overflow-hidden">
                                    {/* Animated border glow on hover */}
                                    <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: 'conic-gradient(from 0deg, transparent, #4ade9a, transparent, #4ade9a, transparent)', padding: '1px', mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)', maskComposite: 'exclude', WebkitMaskComposite: 'xor', animation: 'none' }}></div>
                                    {/* Top-left corner bracket */}
                                    <div className="absolute top-0 left-0 w-7 h-7">
                                        <div className="absolute top-0 left-0 w-full h-[2px] bg-[#4ade9a]/30 group-hover:bg-[#4ade9a]/70 transition-all duration-400"></div>
                                        <div className="absolute top-0 left-0 h-full w-[2px] bg-[#4ade9a]/30 group-hover:bg-[#4ade9a]/70 transition-all duration-400"></div>
                                    </div>
                                    {/* Top-right corner bracket */}
                                    <div className="absolute top-0 right-0 w-7 h-7">
                                        <div className="absolute top-0 right-0 w-full h-[2px] bg-[#4ade9a]/30 group-hover:bg-[#4ade9a]/70 transition-all duration-400"></div>
                                        <div className="absolute top-0 right-0 h-full w-[2px] bg-[#4ade9a]/30 group-hover:bg-[#4ade9a]/70 transition-all duration-400"></div>
                                    </div>
                                    {/* Bottom-left corner bracket */}
                                    <div className="absolute bottom-0 left-0 w-7 h-7">
                                        <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#4ade9a]/30 group-hover:bg-[#4ade9a]/70 transition-all duration-400"></div>
                                        <div className="absolute bottom-0 left-0 h-full w-[2px] bg-[#4ade9a]/30 group-hover:bg-[#4ade9a]/70 transition-all duration-400"></div>
                                    </div>
                                    {/* Bottom-right corner bracket */}
                                    <div className="absolute bottom-0 right-0 w-7 h-7">
                                        <div className="absolute bottom-0 right-0 w-full h-[2px] bg-[#4ade9a]/30 group-hover:bg-[#4ade9a]/70 transition-all duration-400"></div>
                                        <div className="absolute bottom-0 right-0 h-full w-[2px] bg-[#4ade9a]/30 group-hover:bg-[#4ade9a]/70 transition-all duration-400"></div>
                                    </div>

                                    {/* Glowing icon */}
                                    <div className="relative w-16 h-16 mb-6 flex items-center justify-center">
                                        <div className="absolute inset-0 bg-[#4ade9a]/10 rounded-full blur-xl group-hover:bg-[#4ade9a]/20 transition-all duration-400"></div>
                                        <div className="relative w-14 h-14 bg-[#4ade9a]/10 border border-[#4ade9a]/20 rounded-full flex items-center justify-center text-2xl group-hover:border-[#4ade9a]/40 transition-all duration-400">
                                            {card.icon}
                                        </div>
                                    </div>

                                    <h3 className="text-xl font-bold mb-3 text-white">{card.title}</h3>
                                    <p className="text-[#a8a8a0] text-sm leading-relaxed">{card.desc}</p>
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
                        <div className="bg-[#1a2a22] border border-[#2a3d30] rounded-xl overflow-hidden hover:border-[#4ade9a]/30 transition-all duration-500">
                            {/* Window chrome */}
                            <div className="flex items-center gap-2 px-4 py-2.5 bg-[#0d1a14] border-b border-[#2a3d30]">
                                <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]"></div>
                                <span className="ml-2 text-[10px] text-[#a8a8a0]">Cashmere — AI Insights</span>
                            </div>
                            <div className="p-8 space-y-6">
                                {/* AI Summary Card */}
                                <div className="bg-[#111c18] border border-[#2a3d30]/50 rounded-3xl p-8 shadow-2xl relative overflow-hidden group">
                                    <div className="absolute top-6 right-6 opacity-20">
                                        <svg className="w-8 h-8 text-[#4ade9a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-3xl font-serif font-bold text-[#f0ede8] mb-6" style={{ fontFamily: 'Playfair Display, serif' }}>Portfolio Pulse</h3>
                                    <p className="text-base text-[#a8a8a0] leading-relaxed">
                                        <span className="text-[#4ade9a] font-bold">AI Insights:</span> Your portfolio shows concentration in large-cap tech, with both Amazon and Meta Platforms being prominent holdings. Recent news suggests some investor caution regarding Amazon's free cash flow, while Meta is seeing positive sentiment from a notable investor like Bill Ackman. Both companies operate in dynamic sectors with ongoing innovation, but also face scrutiny.
                                    </p>
                                </div>

                                {/* Score badges row */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="flex flex-col gap-4 p-6 bg-[#111c18] border border-[#2a3d30]/50 rounded-2xl transition-all duration-300 hover:border-[#4ade9a]/30">
                                        <span className="text-sm font-medium text-[#a8a8a0]">Valuation Risk</span>
                                        <span className="text-sm font-bold px-4 py-2 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 w-fit">75/100</span>
                                    </div>
                                    <div className="flex flex-col gap-4 p-6 bg-[#111c18] border border-[#2a3d30]/50 rounded-2xl transition-all duration-300 hover:border-[#4ade9a]/30">
                                        <span className="text-sm font-medium text-[#a8a8a0]">Growth Potential</span>
                                        <span className="text-sm font-bold px-4 py-2 rounded-full bg-[#4ade9a]/10 text-[#4ade9a] border border-[#4ade9a]/20 w-fit">80/100</span>
                                    </div>
                                    <div className="flex flex-col gap-4 p-6 bg-[#111c18] border border-[#2a3d30]/50 rounded-2xl transition-all duration-300 hover:border-[#4ade9a]/30">
                                        <span className="text-sm font-medium text-[#a8a8a0]">Political Climate</span>
                                        <span className="text-sm font-bold px-4 py-2 rounded-full bg-[#4ade9a]/10 text-[#4ade9a] border border-[#4ade9a]/20 w-fit">60/100</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </AnimateIn>
                </div>
            </section>

            {/* 4. Live Markets Preview */}
            <section className="relative py-24 px-6" style={{ background: 'linear-gradient(to bottom, #111c18, #0d1a14)' }}>
                <div className="max-w-7xl mx-auto">
                    <AnimateIn className="text-center mb-16">
                        <h2 className="text-5xl font-serif font-bold mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>Real-Time Market Data</h2>
                        <p className="text-lg text-[#a8a8a0]">Everything you need to make informed decisions, at a glance</p>
                    </AnimateIn>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-12">
                        {/* LEFT COLUMN: Indicators */}
                        <div className="flex flex-col gap-6">
                            {/* Market Overview Section */}
                            <AnimateIn>
                                <div className="space-y-3">
                                    <h3 className="text-[10px] font-bold tracking-[0.2em] text-[#a8a8a0] uppercase">Market Overview</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        {[
                                            { label: 'S&P 500', val: '6,909.51', pct: '0.69', path: 'M0 45C10 40 20 50 30 45C40 40 50 20 60 25C70 30 80 15 90 20C100 25 110 35 120 20C130 15 140 25 150 10C160 5 170 15 180 12C190 10 200 15 210 10C220 5 230 15 240 10' },
                                            { label: 'NASDAQ', val: '22,886.07', pct: '0.90', path: 'M0 40C10 45 20 35 30 40C40 45 50 30 60 35C70 40 80 25 90 30C100 35 110 20 120 25C130 30 140 15 150 20C160 25 170 10 180 15C190 20 200 5 210 10C220 15 230 5 240 8' },
                                            { label: 'DOW JONES', val: '49,625.97', pct: '0.47', path: 'M0 35C10 40 20 30 30 35C40 40 50 25 60 30C70 35 80 20 90 25C100 30 110 15 120 20C130 25 140 10 150 15C160 20 170 5 180 10C190 15 200 3 210 8C220 12 230 5 240 6' },
                                        ].map((idx, i) => (
                                            <div key={i} className="bg-[#111c18] border border-[#2a3d30]/50 rounded-2xl p-5 pt-6 pb-20 shadow-xl relative overflow-hidden group hover:border-[#4ade9a]/30 transition-all duration-500 cursor-pointer">
                                                <div className="relative z-10 flex flex-col gap-1.5">
                                                    <span className="text-[9px] font-bold tracking-widest text-[#a8a8a0] uppercase">{idx.label}</span>
                                                    <div className="flex flex-col gap-0">
                                                        <span className="text-xl font-black text-white leading-tight">{idx.val}</span>
                                                        <span className="flex items-center gap-1 text-[10px] font-bold text-[#4ade9a]">
                                                            <span className="text-[8px]">▲</span> {idx.pct}%
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="absolute bottom-0 left-0 right-0 h-16 opacity-40">
                                                    <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 240 60">
                                                        <defs>
                                                            <linearGradient id={`grad-small-${i}`} x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="0%" stopColor="#4ade9a" stopOpacity="0.1" />
                                                                <stop offset="100%" stopColor="#4ade9a" stopOpacity="0" />
                                                            </linearGradient>
                                                        </defs>
                                                        <path d={`${idx.path} V 60 H 0 Z`} fill={`url(#grad-small-${i})`} />
                                                        <path d={idx.path} fill="none" stroke="#4ade9a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                    </svg>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </AnimateIn>

                            {/* Market Breadth Card */}
                            <AnimateIn delay={0.1}>
                                <div className="bg-[#111c18] border border-[#2a3d30]/50 rounded-2xl p-5 shadow-xl">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-[9px] font-bold tracking-[0.2em] text-[#a8a8a0] uppercase">Market Breadth</h3>
                                        <span className="text-[9px] text-[#a8a8a0]">Advance / Decline</span>
                                    </div>
                                    <div className="flex items-center gap-3 mb-3">
                                        <span className="flex items-center gap-1 text-sm font-black text-[#4ade9a]">
                                            <span className="text-xs">↑</span> 2,667
                                        </span>
                                        <span className="text-[#a8a8a0] text-[9px] font-bold">vs</span>
                                        <span className="flex items-center gap-1 text-sm font-black text-red-500">
                                            <span className="text-xs">↓</span> 1,333
                                        </span>
                                    </div>
                                    <div className="w-full h-1.5 rounded-full overflow-hidden flex bg-[#2a1a1a]">
                                        <div className="h-full bg-[#4ade9a] transition-all duration-1000" style={{ width: '67%' }} />
                                    </div>
                                    <div className="flex justify-between mt-2 text-[9px] font-medium">
                                        <span className="text-[#a8a8a0]">67% advancing</span>
                                        <span className="text-[#a8a8a0]">33% declining</span>
                                    </div>
                                </div>
                            </AnimateIn>

                            {/* Fear & Greed Index Card */}
                            <AnimateIn delay={0.2}>
                                <div className="bg-[#111c18] border border-[#2a3d30]/50 rounded-2xl p-5 shadow-xl">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-[9px] font-bold tracking-[0.2em] text-[#a8a8a0] uppercase">Fear & Greed Index</h3>
                                    </div>
                                    <div className="relative h-2.5 mt-2">
                                        <div className="absolute inset-0 w-full h-full rounded-full bg-gradient-to-r from-red-600 via-yellow-400 to-[#4ade9a]"></div>
                                        <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-[#4ade9a] rounded-full shadow-[0_0_10px_rgba(74,222,154,0.4)] z-10" style={{ left: '77%' }}></div>
                                    </div>
                                    <div className="flex justify-between text-[8px] font-bold uppercase tracking-wider mt-1.5 mb-1">
                                        <span className="text-red-600">Extreme Fear</span>
                                        <span className="text-[#4ade9a]">Extreme Greed</span>
                                    </div>
                                    <div className="text-center">
                                        <span className="text-xl font-black text-[#4ade9a]">77</span>
                                    </div>
                                </div>
                            </AnimateIn>
                        </div>

                        {/* RIGHT COLUMN: Sector Performance */}
                        <div className="flex flex-col">
                            <AnimateIn delay={0.3}>
                                <div className="space-y-3">
                                    <h3 className="text-[10px] font-bold tracking-[0.2em] text-[#a8a8a0] uppercase">Sector Performance</h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        {[
                                            { name: 'Tech', pct: '+0.48%', pos: true },
                                            { name: 'Finance', pct: '+0.65%', pos: true },
                                            { name: 'Health', pct: '-0.28%', pos: false },
                                            { name: 'Energy', pct: '-0.54%', pos: false },
                                            { name: 'Cons. D', pct: '+1.04%', pos: true },
                                            { name: 'Cons. S', pct: '+0.25%', pos: true },
                                            { name: 'Indust.', pct: '+0.50%', pos: true },
                                            { name: 'Materials', pct: '+0.25%', pos: true },
                                            { name: 'RE', pct: '+0.83%', pos: true },
                                            { name: 'Utilities', pct: '+0.48%', pos: true },
                                            { name: 'Comm.', pct: '+1.44%', pos: true },
                                        ].map((s, i) => (
                                            <div key={i} className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all duration-300 hover:scale-[1.02] cursor-pointer ${s.pos ? 'bg-[#4ade9a]/5 border-[#4ade9a]/10' : 'bg-red-500/5 border-red-500/10'
                                                }`}>
                                                <span className="text-[11px] font-bold text-[#a8a8a0] mb-0.5">{s.name}</span>
                                                <span className={`text-sm font-black ${s.pos ? 'text-[#4ade9a]' : 'text-red-400'}`}>{s.pct}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </AnimateIn>
                        </div>
                    </div>
                </div>
            </section>

            {/* 5. How Does It Work */}
            <section className="relative py-24 px-6 overflow-hidden" style={{ background: '#0f1d17' }}>
                {/* Flowing green silk blobs */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <div className="absolute w-[500px] h-[500px] bg-[#4ade9a]/10 rounded-full blur-3xl animate-blob1" style={{ top: '10%', left: '-10%' }}></div>
                    <div className="absolute w-[400px] h-[400px] bg-[#4ade9a]/8 rounded-full blur-3xl animate-blob2" style={{ top: '50%', right: '-5%' }}></div>
                    <div className="absolute w-[600px] h-[600px] bg-[#4ade9a]/6 rounded-full blur-3xl animate-blob3" style={{ bottom: '-15%', left: '30%' }}></div>
                </div>
                <div className="max-w-5xl mx-auto relative z-10">
                    <AnimateIn className="text-center mb-12">
                        <h2 className="text-5xl font-serif font-bold mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>How does it work?</h2>
                        <p className="text-lg text-[#a8a8a0]">Get started in three simple steps</p>
                    </AnimateIn>

                    {/* Panel area */}
                    <AnimateIn delay={0.15}>
                        <div className="relative bg-[#0d1a14] border border-[#2a3d30] rounded-2xl p-6 md:p-8 min-h-[400px] flex items-center justify-center mb-12 overflow-hidden">
                            {/* Subtle corner glow */}
                            <div className="absolute top-0 left-0 w-32 h-32 bg-[#4ade9a]/5 rounded-full blur-3xl"></div>
                            <div className="absolute bottom-0 right-0 w-32 h-32 bg-[#4ade9a]/5 rounded-full blur-3xl"></div>

                            {activeStep === 0 && (
                                <div className="w-full max-w-lg mx-auto" style={{ animation: 'fadeInUp 0.4s ease' }}>
                                    {/* Compact Portfolio Mockup */}
                                    <div className="bg-[#111c18] border border-[#2a3d30]/50 rounded-2xl p-5 shadow-2xl relative overflow-hidden group hover:border-[#4ade9a]/30 transition-all duration-500">
                                        <div className="flex justify-between items-start gap-4 mb-5">
                                            {/* Left: Total Value */}
                                            <div className="flex flex-col gap-1">
                                                <div className="text-[8px] font-bold tracking-[0.2em] text-[#a8a8a0] uppercase">Total Portfolio Value</div>
                                                <div className="text-3xl font-black text-white">$10,301.95</div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#4ade9a]/10 border border-[#4ade9a]/20 text-[#4ade9a] text-[9px] font-bold">
                                                        <span>▲</span> +$301.95
                                                    </span>
                                                    <span className="text-[9px] text-[#a8a8a0]">vs $10k initial</span>
                                                </div>
                                            </div>

                                            {/* Right: Available Cash Card */}
                                            <div className="bg-[#0d1a14] border border-[#2a3d30] rounded-xl p-3 min-w-[130px] shadow-xl relative overflow-hidden">
                                                <div className="text-[8px] font-bold tracking-[0.2em] text-[#a8a8a0] uppercase mb-1">Available Cash</div>
                                                <div className="text-lg font-black text-[#4ade9a]">$9,436.18</div>
                                                <div className="text-[8px] text-[#a8a8a0]">92% weight</div>
                                            </div>
                                        </div>

                                        {/* Holdings Table */}
                                        <div className="w-full">
                                            <div className="grid grid-cols-5 border-b border-[#2a3d30]/30 pb-2 mb-2 text-[8px] font-bold tracking-[0.2em] text-[#a8a8a0] uppercase">
                                                <span>Ticker</span>
                                                <span className="text-right">Shares</span>
                                                <span className="text-right">Price</span>
                                                <span className="text-right">Val</span>
                                                <span className="text-right">P&L</span>
                                            </div>
                                            <div className="space-y-0.5">
                                                {[
                                                    { ticker: 'AMZN', name: 'Amazon', shares: '1', curr: '$210.11', val: '$210', pl: '+114.32', plPct: '+119%' },
                                                    { ticker: 'META', name: 'Meta', shares: '1', curr: '$655.66', val: '$655', pl: '+187.63', plPct: '+40%' }
                                                ].map((item, i) => (
                                                    <div key={i} className="grid grid-cols-5 items-center py-2.5 border-b border-[#2a3d30]/10 last:border-0 hover:bg-white/[0.02] transition-colors rounded px-1.5 -mx-1.5 cursor-pointer">
                                                        <div>
                                                            <div className="text-[11px] font-bold text-white mb-0.5">{item.ticker}</div>
                                                            <div className="text-[9px] text-[#a8a8a0]">{item.name}</div>
                                                        </div>
                                                        <div className="text-right text-[10px] font-bold text-white">{item.shares}</div>
                                                        <div className="text-right text-[10px] font-bold text-white">{item.curr}</div>
                                                        <div className="text-right text-[10px] font-bold text-white">{item.val}</div>
                                                        <div className="text-right">
                                                            <div className="text-[10px] font-bold text-[#4ade9a] leading-none mb-0.5">{item.pl}</div>
                                                            <div className="text-[8px] font-bold text-[#4ade9a]">{item.plPct}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {activeStep === 1 && (
                                <div className="w-full max-w-lg mx-auto" style={{ animation: 'fadeInUp 0.4s ease' }}>
                                    {/* Compact Markets Mockup */}
                                    <div className="bg-[#111c18] border border-[#2a3d30]/50 rounded-2xl p-5 shadow-2xl relative overflow-hidden group hover:border-[#4ade9a]/30 transition-all duration-500">
                                        <div className="bg-[#0b1410] border border-[#2a3d30]/50 rounded-xl px-3 py-2 flex items-center gap-2.5 mb-5 cursor-pointer">
                                            <svg className="w-3.5 h-3.5 text-[#a8a8a0]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                            <span className="text-[11px] text-[#5a6b61]">Search symbol / name...</span>
                                        </div>

                                        <div className="mb-6">
                                            <h3 className="text-[8px] font-bold tracking-[0.2em] text-[#a8a8a0] uppercase mb-2.5">Quick Watch</h3>
                                            <div className="flex gap-1.5 items-center overflow-x-auto pb-2 no-scrollbar">
                                                {[
                                                    { t: 'NVDA', p: '+1.02%', pos: true },
                                                    { t: 'AAPL', p: '+1.54%', pos: true },
                                                    { t: 'TSLA', p: '+0.03%', pos: true },
                                                    { t: 'AMZN', p: '+2.56%', pos: true },
                                                    { t: 'MSFT', p: '-0.31%', pos: false },
                                                ].map((tick, i) => (
                                                    <div key={i} className="flex-shrink-0 bg-[#0d1a14] border border-[#2a3d30] rounded-xl p-2.5 min-w-[70px] text-center cursor-pointer hover:border-[#4ade9a]/20 transition-all">
                                                        <div className="text-[10px] font-bold text-white mb-0.5">{tick.t}</div>
                                                        <div className={`text-[8px] font-bold ${tick.pos ? 'text-[#4ade9a]' : 'text-red-400'}`}>{tick.p}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <h3 className="text-[8px] font-bold tracking-[0.2em] text-[#a8a8a0] uppercase mb-2.5">Discovery</h3>
                                            <div className="bg-[#0b1410] border border-[#2a3d30]/50 rounded-xl p-1 flex gap-1 mb-4">
                                                <div className="flex-1 text-center py-1.5 bg-[#4ade9a] text-[#0d1a14] rounded-lg text-[9px] font-bold shadow-lg cursor-pointer">↑ Gainers</div>
                                                <div className="flex-1 text-center py-1.5 text-[#a8a8a0] text-[9px] font-bold cursor-pointer hover:text-white transition-colors">↓ Losers</div>
                                                <div className="flex-1 text-center py-1.5 text-[#a8a8a0] text-[9px] font-bold cursor-pointer hover:text-white transition-colors">⚡ Vol</div>
                                            </div>

                                            <div className="space-y-0 text-white">
                                                {[
                                                    { s: 'RNG', n: 'Ringcentral', p: '$39.50', ch: '+34.4%' },
                                                    { s: 'LGN', n: 'Legence', p: '$55.24', ch: '+16.8%' },
                                                    { s: 'TLX', n: 'Telix Pharma', p: '$7.69', ch: '+14.6%' },
                                                ].map((stock, i) => (
                                                    <div key={i} className="flex items-center justify-between py-2.5 border-b border-[#2a3d30]/10 last:border-0 hover:bg-white/[0.02] transition-colors rounded px-1.5 -mx-1.5 cursor-pointer">
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="text-[11px] font-bold">{stock.s}</span>
                                                            <span className="text-[8px] text-[#a8a8a0]">{stock.n}</span>
                                                        </div>
                                                        <div className="text-right flex flex-col gap-0.5">
                                                            <span className="text-[11px] font-bold">{stock.p}</span>
                                                            <span className="text-[9px] font-bold text-[#4ade9a]">{stock.ch}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {activeStep === 2 && (
                                <div className="w-full" style={{ animation: 'fadeInUp 0.4s ease' }}>
                                    {/* Mini Feed Replica */}
                                    <div className="bg-[#111c18] border border-[#2a3d30] rounded-xl overflow-hidden max-w-lg mx-auto">
                                        <div className="flex items-center gap-2 px-4 py-2.5 bg-[#0d1a14] border-b border-[#2a3d30]">
                                            <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]"></div>
                                            <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]"></div>
                                            <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]"></div>
                                            <span className="ml-2 text-[10px] text-[#a8a8a0]">Cashmere — Feed</span>
                                        </div>
                                        <div className="p-5 space-y-3">
                                            {[
                                                { avatar: 'SJ', color: 'bg-blue-500', name: 'Advay K', time: '2h ago', action: 'purchased 15 shares of', ticker: 'TSLA', likes: 12, comments: 3 },
                                                { avatar: 'MR', color: 'bg-purple-500', name: 'Neel M', time: '5h ago', action: 'hit a new all-time high portfolio value!', ticker: 'Portfolio', likes: 24, comments: 8 },
                                                { avatar: 'EC', color: 'bg-pink-500', name: 'Karan K', time: '1d ago', action: 'sold their position in', ticker: 'AAPL', likes: 7, comments: 2 },
                                            ].map((post, i) => (
                                                <div key={i} className="bg-[#0d1a14] border border-[#2a3d30]/50 rounded-lg p-3 cursor-pointer hover:border-[#4ade9a]/20 transition-colors">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <div className={`w-7 h-7 rounded-full ${post.color} flex items-center justify-center text-[9px] font-bold text-white`}>{post.avatar}</div>
                                                        <div>
                                                            <div className="text-xs font-bold text-white">{post.name}</div>
                                                            <div className="text-[9px] text-[#a8a8a0]">{post.time}</div>
                                                        </div>
                                                    </div>
                                                    <p className="text-[11px] text-[#a8a8a0] mb-2">
                                                        {post.action}{' '}
                                                        <span className="font-bold text-white bg-[#4ade9a]/10 px-1.5 py-0.5 rounded text-[#4ade9a]">{post.ticker}</span>
                                                    </p>
                                                    <div className="flex items-center gap-4 text-[10px] text-[#a8a8a0]">
                                                        <span>👍 {post.likes}</span>
                                                        <span>💬 {post.comments}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </AnimateIn>

                    {/* Steps row with progress bar */}
                    <AnimateIn delay={0.3}>
                        <div className="relative">
                            {/* Progress bar background */}
                            <div className="absolute top-5 left-[16.66%] right-[16.66%] h-[2px] bg-[#2a3d30]"></div>
                            {/* Progress bar fill */}
                            <div className="absolute top-5 left-[16.66%] h-[2px] bg-[#4ade9a] transition-all duration-500" style={{ width: `${activeStep * 33.33}%` }}></div>

                            <div className="relative grid grid-cols-3 gap-4">
                                {[
                                    { label: 'STEP 1', title: 'Track Your Portfolio', desc: 'See all your positions, live P&L, AI insights, and account analytics in one beautiful dashboard.' },
                                    { label: 'STEP 2', title: 'Explore Markets', desc: 'Real-time indices, top gainers, sector heatmaps, and a powerful search — all the data you need.' },
                                    { label: 'STEP 3', title: 'Connect & Share', desc: 'Follow friends, see their trades, react and comment — investing is better together.' },
                                ].map((step, i) => (
                                    <div key={i} className="flex flex-col items-center cursor-pointer group" onClick={() => setActiveStep(i)}>
                                        {/* Step dot */}
                                        <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-xs font-bold mb-4 transition-all duration-300 ${i <= activeStep
                                            ? 'bg-[#4ade9a] border-[#4ade9a] text-[#0d1a14]'
                                            : 'bg-transparent border-[#2a3d30] text-[#a8a8a0] group-hover:border-[#4ade9a]/50'
                                            }`}>
                                            {i + 1}
                                        </div>
                                        <span className={`text-xs uppercase tracking-widest mb-2 transition-colors duration-300 ${i === activeStep ? 'text-[#4ade9a]' : 'text-[#a8a8a0]'}`}>{step.label}</span>
                                        <h4 className={`text-sm font-semibold mb-1 transition-colors duration-300 ${i === activeStep ? 'text-white' : 'text-[#a8a8a0]'}`}>{step.title}</h4>
                                        <p className={`text-xs text-center leading-relaxed transition-all duration-300 max-w-[220px] ${i === activeStep ? 'text-[#a8a8a0] opacity-100' : 'opacity-0 h-0 overflow-hidden md:opacity-50 md:h-auto'}`}>{step.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </AnimateIn>
                </div>
            </section>

            {/* 6. Trusted by Millions */}
            <section className="relative py-24 px-6 overflow-hidden" style={{ background: 'linear-gradient(to bottom, #0d1a14, #111c18)' }}>
                {/* Cinematic watermark */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                    <span className="text-[160px] md:text-[220px] font-black text-white/[0.03] leading-none tracking-tighter">TRUST</span>
                </div>
                <div className="max-w-5xl mx-auto text-center relative z-10">
                    <AnimateIn>
                        <h2 className="text-5xl font-serif font-bold mb-16" style={{ fontFamily: 'Playfair Display, serif' }}>Built for Serious Investors</h2>
                    </AnimateIn>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                        {[
                            { value: 50, suffix: '+', label: 'Stocks, Crypto & ETFs' },
                            { value: 10, suffix: 's', label: 'Live Price Refresh Rate' },
                            { static: '24/7', label: 'AI Portfolio Analysis' },
                        ].map((s: any, i) => (
                            <AnimateIn key={i} delay={i * 0.15}>
                                <div>
                                    <div className="text-5xl font-bold text-[#4ade9a] mb-2">
                                        {s.static ? s.static : <CountUp target={s.value} prefix={s.prefix || ''} suffix={s.suffix || ''} />}
                                    </div>
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
                            { name: 'Neel M.', text: 'Cashmere completely changed how I invest. The AI insights are incredible.' },
                            { name: 'Karan K.', text: 'Best trading platform I have used. Clean interface and powerful tools.' },
                            { name: 'Anubhav B.', text: 'Cashmere makes complicated stock information so easy to understand.' },
                        ].map((t, i) => (
                            <AnimateIn key={i} delay={i * 0.12}>
                                <div className="p-8 bg-[#1a2a22]/50 border border-[#2a3d30] rounded-xl hover:border-[#4ade9a]/30 transition-all duration-300 hover:-translate-y-1 cursor-pointer">
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
                        {faqs.map((faq, i) => {
                            const isOpen = openFaqs.includes(i);
                            return (
                                <AnimateIn key={i} delay={i * 0.08}>
                                    <div className={`border rounded-xl overflow-hidden transition-all duration-300 cursor-pointer ${isOpen ? 'border-[#4ade9a]/50 bg-[#1a2a22]/20' : 'border-[#2a3d30] hover:border-[#4ade9a]/30'}`}>
                                        <button
                                            onClick={() => toggleFaq(i)}
                                            className="w-full text-left px-6 py-4 flex items-center justify-between hover:bg-[#1a2a22]/50 transition cursor-pointer"
                                        >
                                            <span className={`font-semibold transition-colors duration-300 ${isOpen ? 'text-[#4ade9a]' : 'text-white'}`}>{faq.q}</span>
                                            <span className="text-[#4ade9a] text-xl transition-transform duration-300" style={{ transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)' }}>+</span>
                                        </button>
                                        <div
                                            className="overflow-hidden transition-all duration-300"
                                            style={{ maxHeight: isOpen ? '240px' : '0px', opacity: isOpen ? 1 : 0 }}
                                        >
                                            <div className="px-6 pb-5 text-[#a8a8a0] text-sm leading-relaxed border-t border-[#2a3d30]/30 pt-4">{faq.a}</div>
                                        </div>
                                    </div>
                                </AnimateIn>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* 9. Final CTA */}
            <section className="relative py-32 px-6 text-center overflow-hidden" style={{ background: '#0a1410', backgroundImage: 'radial-gradient(circle, #2a3d30 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
                {/* Section corner brackets */}
                <div className="absolute top-6 left-6 w-12 h-12">
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-[#4ade9a]/30"></div>
                    <div className="absolute top-0 left-0 h-full w-[2px] bg-[#4ade9a]/30"></div>
                </div>
                <div className="absolute top-6 right-6 w-12 h-12">
                    <div className="absolute top-0 right-0 w-full h-[2px] bg-[#4ade9a]/30"></div>
                    <div className="absolute top-0 right-0 h-full w-[2px] bg-[#4ade9a]/30"></div>
                </div>
                <div className="absolute bottom-6 left-6 w-12 h-12">
                    <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#4ade9a]/30"></div>
                    <div className="absolute bottom-0 left-0 h-full w-[2px] bg-[#4ade9a]/30"></div>
                </div>
                <div className="absolute bottom-6 right-6 w-12 h-12">
                    <div className="absolute bottom-0 right-0 w-full h-[2px] bg-[#4ade9a]/30"></div>
                    <div className="absolute bottom-0 right-0 h-full w-[2px] bg-[#4ade9a]/30"></div>
                </div>

                <AnimateIn>
                    <div className="max-w-3xl mx-auto relative z-10">
                        {/* Logo */}
                        <div className="w-14 h-14 bg-[#4ade9a] rounded-xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-[#4ade9a]/20">
                            <span className="text-[#0d1a14] font-bold text-xl">C</span>
                        </div>

                        {/* Heading with cycling word */}
                        <h2 className="text-5xl md:text-6xl font-bold mb-6 leading-tight text-white" style={{ fontFamily: 'Playfair Display, serif' }}>
                            Join us today and<br />start building{' '}
                            <span className="relative inline-block">
                                <span key={cycleWord} className="text-[#4ade9a]" style={{ animation: 'wordCycle 0.5s ease' }}>
                                    {cycleWords[cycleWord]}
                                </span>
                                <span className="inline-block w-[2px] h-[0.9em] bg-[#4ade9a] ml-1 align-middle" style={{ animation: 'blink 1s step-end infinite' }}></span>
                            </span>
                        </h2>

                        <p className="text-lg text-[#a8a8a0] mb-10 max-w-xl mx-auto leading-relaxed">
                            Join millions of investors worldwide who trust Cashmere to grow their wealth with cutting-edge tools and zero barriers.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <button className="px-8 py-3.5 border border-[#2a3d30] hover:border-[#4ade9a] rounded-full font-semibold transition-all duration-300 hover:bg-[#4ade9a]/10 cursor-pointer">Try for free</button>
                            <Link href="/login" className="px-8 py-3.5 bg-[#4ade9a] hover:bg-[#22c55e] text-[#0d1a14] rounded-full font-semibold transition-all duration-300 transform hover:scale-105 animate-btnPulse cursor-pointer">Get Started</Link>
                        </div>
                    </div>
                </AnimateIn>
            </section>



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
                @keyframes wordCycle {
                    0% { opacity: 0; transform: translateY(10px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                @keyframes blink {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0; }
                }
                @keyframes barGrow {
                    from { width: 0%; }
                }
                @keyframes btnPulse {
                    0% { box-shadow: 0 0 0 0 rgba(74,222,154,0.4); }
                    70% { box-shadow: 0 0 0 18px rgba(74,222,154,0); }
                    100% { box-shadow: 0 0 0 0 rgba(74,222,154,0); }
                }
                .animate-btnPulse {
                    animation: btnPulse 2.5s ease-in-out infinite;
                }
                @keyframes waveSlide1 {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                @keyframes waveSlide2 {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                @keyframes waveSlide3 {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                .animate-wave1 { animation: waveSlide1 20s linear infinite; }
                .animate-wave2 { animation: waveSlide2 14s linear infinite; }
                .animate-wave3 { animation: waveSlide3 9s linear infinite; }
                @keyframes blobDrift1 {
                    0%, 100% { transform: translate(0, 0) rotate(0deg); }
                    33% { transform: translate(80px, -60px) rotate(120deg); }
                    66% { transform: translate(-40px, 40px) rotate(240deg); }
                }
                @keyframes blobDrift2 {
                    0%, 100% { transform: translate(0, 0) rotate(0deg); }
                    33% { transform: translate(-60px, 80px) rotate(-120deg); }
                    66% { transform: translate(50px, -30px) rotate(-240deg); }
                }
                @keyframes blobDrift3 {
                    0%, 100% { transform: translate(0, 0) rotate(0deg); }
                    33% { transform: translate(40px, 60px) rotate(90deg); }
                    66% { transform: translate(-70px, -40px) rotate(200deg); }
                }
                .animate-blob1 { animation: blobDrift1 15s ease-in-out infinite; }
                .animate-blob2 { animation: blobDrift2 22s ease-in-out infinite; }
                .animate-blob3 { animation: blobDrift3 18s ease-in-out infinite; }
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
