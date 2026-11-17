import React, { useState } from 'react';
import { Lock, Mail } from 'lucide-react';
import { apiRequest } from '../services/api';
import { heroMakkahImg } from '../utils/packageImages';
import { HijriDateLine, RubElHizbMark } from './IslamicOrnament';

interface LoginViewProps {
    onLoginSuccess: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            await apiRequest('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password }),
            });
            onLoginSuccess();
        } catch (err: any) {
            setError(err.message || 'Gagal login. Periksa kembali email & password Anda.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F6F7F6] grid grid-cols-1 lg:grid-cols-12">
            {/* Panel Kiri: Showcase Arsitektur Islami & Proposisi Nilai */}
            <div className="hidden lg:flex lg:col-span-7 relative bg-[#071D17] text-white overflow-hidden flex-col justify-between p-12">
                <img
                    src={heroMakkahImg}
                    alt="Arsitektur pelataran marmer nuansa Islami saat fajar"
                    className="absolute inset-0 w-full h-full object-cover opacity-45"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#051410] via-[#071D17]/75 to-[#071D17]/60 islamic-girih-dark" />

                <div className="relative z-10 flex items-center justify-between">
                    <div className="inline-flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/10 border border-amber-300/35 flex items-center justify-center">
                            <RubElHizbMark className="w-5 h-5 text-amber-300" />
                        </div>
                        <div>
                            <div className="font-display font-bold text-lg tracking-tight">SafarLedger ERP</div>
                            <div className="text-xs text-amber-200/80">Sistem Tata Kelola Travel Haji &amp; Umrah</div>
                        </div>
                    </div>
                    <HijriDateLine className="text-xs text-emerald-100/80" />
                </div>

                <div className="relative z-10 max-w-xl space-y-5">
                    <div className="text-xs font-semibold tracking-wide text-amber-300">
                        Amanah · Transparan · Sesuai SAK ETAP &amp; Regulasi Kemenag
                    </div>
                    <h1 className="text-4xl font-bold font-display leading-tight text-balance">
                        Kendalikan Operasional Jamaah &amp; Keuangan Syariah dalam Satu Pintu
                    </h1>
                    <p className="text-sm text-emerald-100/80 leading-relaxed">
                        Mulai dari manifes keberangkatan, rooming mahram, kepatuhan paspor DMS terenkripsi, hingga kuitansi QR dan pengakuan pendapatan kloter otomatis.
                    </p>
                    <div className="gold-hairline-b pt-2" />
                    <div className="grid grid-cols-3 gap-6 pt-2 text-xs">
                        <div>
                            <div className="text-amber-300 font-semibold font-display">SAK ETAP</div>
                            <div className="text-emerald-100/70 mt-0.5">Jurnal otomatis per keberangkatan</div>
                        </div>
                        <div>
                            <div className="text-amber-300 font-semibold font-display">AES-256 DMS</div>
                            <div className="text-emerald-100/70 mt-0.5">Perlindungan data NIK &amp; Paspor</div>
                        </div>
                        <div>
                            <div className="text-amber-300 font-semibold font-display">ISO 9001 SLA</div>
                            <div className="text-emerald-100/70 mt-0.5">Pengawasan layanan &amp; keagenan</div>
                        </div>
                    </div>
                </div>

                <div className="relative z-10 text-xs text-emerald-100/50">
                    Platform Multi-Tenant SaaS Biro Perjalanan Ibadah Umrah &amp; Haji Khusus
                </div>
            </div>

            {/* Panel Kanan: Form Login Bersih */}
            <div className="lg:col-span-5 flex items-center justify-center p-6 sm:p-10 islamic-girih-light">
                <div className="w-full max-w-md bg-white border border-slate-200/90 rounded-2xl p-8 shadow-[0_4px_24px_rgba(15,23,42,0.05)] space-y-6">
                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 text-emerald-900 lg:hidden mb-2">
                            <RubElHizbMark className="w-5 h-5 text-amber-600" />
                            <span className="font-display font-bold text-base">SafarLedger ERP</span>
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 font-display">
                            Assalamu&apos;alaikum, Selamat Datang
                        </h2>
                        <p className="text-xs text-slate-500 leading-relaxed">
                            Masuk dengan akun perusahaan resmi Anda untuk mengakses dashboard operasional dan keuangan.
                        </p>
                    </div>

                    {error && (
                        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                        <div>
                            <label className="block text-slate-700 font-medium mb-1.5">Email Akun</label>
                            <div className="relative">
                                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="nama@travelanda.co.id"
                                    className="w-full h-10 pl-10 pr-3.5 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-slate-700 font-medium mb-1.5">Kata Sandi</label>
                            <div className="relative">
                                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Masukkan kata sandi"
                                    className="w-full h-10 pl-10 pr-3.5 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-10.5 bg-[#0F4C3A] hover:bg-[#0B3B2D] text-white font-semibold rounded-xl transition-colors shadow-xs disabled:opacity-50 mt-2"
                        >
                            {loading ? 'Memverifikasi Sesi...' : 'Masuk ke Sistem'}
                        </button>
                    </form>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                        <HijriDateLine />
                        <span>Sesi Terenkripsi</span>
                    </div>
                </div>
            </div>
        </div>
    );
};