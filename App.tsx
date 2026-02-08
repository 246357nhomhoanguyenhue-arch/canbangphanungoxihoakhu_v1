
import React, { useState, useEffect } from 'react';
import { User, RedoxStepData, Step } from './types';
import { analyzeRedoxEquation } from './geminiService';
import { Formula } from './components/Formula';
import { 
  LogIn, 
  ChevronRight, 
  RotateCcw, 
  CheckCircle2, 
  XCircle, 
  Search,
  FlaskConical,
  LogOut,
  Info,
  User as UserIcon
} from 'lucide-react';

const API_URL = "https://script.google.com/macros/s/AKfycbyRFP-Am7DSetKdd9uRGAnCIi2MP-QSBHdgUdNehNG07w-spb-droXB_O8AVPR0K31_/exec";

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [page, setPage] = useState<'login' | 'input' | 'exercise'>('login');
  const [equationInput, setEquationInput] = useState('Fe + H2SO4 -> Fe2(SO4)3 + SO2 + H2O');
  const [stepData, setStepData] = useState<RedoxStepData | null>(null);
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Step 1 States
  const [step1OxStates, setStep1OxStates] = useState<Record<string, string>>({});
  const [step1Agents, setStep1Agents] = useState({ reducing: '', oxidizing: '' });

  // Step 2 States
  const [step2OxProcess, setStep2OxProcess] = useState('');
  const [step2RedProcess, setStep2RedProcess] = useState('');

  // Step 3 States
  const [step3Multipliers, setStep3Multipliers] = useState({ ox: '', red: '' });

  // Step 4 States
  const [step4Coeffs, setStep4Coeffs] = useState<string[]>([]);

  const callApi = async (action: string, payload: any) => {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        mode: 'no-cors', // Cần thiết cho Google Apps Script nếu không xử lý OPTIONS
        body: JSON.stringify({ action, payload }),
      });
      // Với no-cors, chúng ta không thể đọc body, nhưng dữ liệu vẫn được gửi đi
      return { ok: true };
    } catch (error) {
      console.error(`API Error (${action}):`, error);
      return { ok: false };
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const name = formData.get('username') as string || 'Học sinh';
    const email = formData.get('email') as string || 'hocsinh@example.com';
    
    const mockUser: User = {
      email: email,
      name: name,
      loginCount: 1,
      lastLogin: new Date().toISOString()
    };
    
    setUser(mockUser);
    setPage('input');

    // Gửi dữ liệu đăng nhập về Google Sheet
    await callApi('LOGIN', {
      name,
      email,
      device: navigator.userAgent
    });
  };

  const startBalancing = async () => {
    if (!equationInput.trim()) return;
    setIsLoading(true);
    setFeedback(null);
    try {
      const data = await analyzeRedoxEquation(equationInput);
      setStepData(data);
      setPage('exercise');
      setCurrentStep(1);
      
      // Ghi lại lịch sử bắt đầu cân bằng phương trình
      const newSessionId = "SESS_" + Date.now();
      setSessionId(newSessionId);
      await callApi('LOG_REACTION', {
        email: user?.email,
        equation: equationInput,
        sessionId: newSessionId
      });

      // Initialize states
      setStep4Coeffs(new Array(data.compoundsLeft.length + data.compoundsRight.length).fill(''));
      setStep1OxStates({});
      setStep1Agents({ reducing: '', oxidizing: '' });
      setStep2OxProcess('');
      setStep2RedProcess('');
      setStep3Multipliers({ ox: '', red: '' });
    } catch (error) {
      setFeedback({ type: 'error', message: 'Không thể phân tích phương trình này. Vui lòng thử lại.' });
    } finally {
      setIsLoading(false);
    }
  };

  const validateStep = async () => {
    if (!stepData) return;
    let isCorrect = false;

    switch (currentStep) {
      case 1:
        const statesCorrect = stepData.elementsChanging.every((el, idx) => {
          const valLeft = step1OxStates[`left_${idx}`];
          const valRight = step1OxStates[`right_${idx}`];
          return parseInt(valLeft) === el.leftState && parseInt(valRight) === el.rightState;
        });
        const agentsCorrect = 
          step1Agents.reducing.toLowerCase().trim() === stepData.reducingAgent.toLowerCase().trim() ||
          step1Agents.oxidizing.toLowerCase().trim() === stepData.oxidizingAgent.toLowerCase().trim() ||
          (step1Agents.reducing.toLowerCase().includes(stepData.reducingAgent.toLowerCase()) && 
           step1Agents.oxidizing.toLowerCase().includes(stepData.oxidizingAgent.toLowerCase()));
        isCorrect = statesCorrect && agentsCorrect;
        break;
      case 2:
        isCorrect = step2OxProcess.length > 5 && step2RedProcess.length > 5;
        break;
      case 3:
        isCorrect = 
          parseInt(step3Multipliers.ox) === stepData.multiplierOx && 
          parseInt(step3Multipliers.red) === stepData.multiplierRed;
        break;
      case 4:
        isCorrect = stepData.balancedCoefficients.every((c, i) => {
          const input = step4Coeffs[i];
          if (c === 1) return input === '' || input === '1';
          return parseInt(input) === c;
        });
        break;
    }

    if (isCorrect) {
      setFeedback({ type: 'success', message: 'Chúc mừng em đã làm đúng!' });
    } else {
      setFeedback({ type: 'error', message: 'Cố gắng làm lại nhé!' });
      // Ghi lại lỗi sai của học sinh về Google Sheet để giáo viên theo dõi
      await callApi('LOG_ERROR', {
        sessionId,
        email: user?.email,
        step: `Bước ${currentStep}`,
        errorDetail: currentStep === 1 ? 'Sai số oxi hóa hoặc chất' : 
                     currentStep === 2 ? 'Sai quá trình e' :
                     currentStep === 3 ? 'Sai hệ số thăng bằng' : 'Sai hệ số phương trình',
        attempts: 1
      });
    }
  };

  const nextStep = () => {
    setFeedback(null);
    if (currentStep < 4) setCurrentStep((prev) => (prev + 1) as Step);
  };

  const resetAll = () => {
    setPage('input');
    setStepData(null);
    setFeedback(null);
    setCurrentStep(1);
    setSessionId(null);
    setStep1OxStates({});
    setStep1Agents({ reducing: '', oxidizing: '' });
    setStep2OxProcess('');
    setStep2RedProcess('');
    setStep3Multipliers({ ox: '', red: '' });
  };

  if (page === 'login') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
        <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md transform transition-all hover:scale-[1.01]">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center p-4 bg-indigo-100 rounded-full mb-4">
              <FlaskConical className="w-10 h-10 text-indigo-600" />
            </div>
            <h1 className="text-3xl font-bold text-slate-800">Redox Pro</h1>
            <p className="text-slate-500 mt-2">Đăng nhập để bắt đầu rèn luyện</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tên đăng nhập (Họ và tên)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <UserIcon size={18} />
                </div>
                <input 
                  name="username"
                  type="text" 
                  required
                  placeholder="Nhập họ và tên của em"
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input 
                name="email"
                type="email" 
                required
                placeholder="email@vidu.com"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              />
            </div>
            <button 
              type="submit"
              className="w-full bg-slate-900 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-slate-800 active:bg-slate-950 transition-colors shadow-lg shadow-indigo-200"
            >
              <LogIn size={20} />
              Đăng nhập
            </button>
          </form>
          
          <div className="mt-8 pt-6 border-t border-slate-100">
            <p className="text-[11px] text-center text-slate-500 leading-relaxed italic">
              Thiết kế và phát triển bởi:<br/>
              <span className="font-bold text-slate-700 not-italic">cô Nguyễn Thị Hồng Anh</span><br/>
              GV Hóa Học - Trường THPT Nguyễn Huệ - BRVT
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (page === 'input') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <FlaskConical className="text-indigo-600 w-6 h-6" />
            <span className="font-bold text-xl text-slate-800">Redox Pro</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500">Chào, <span className="font-semibold text-slate-700">{user?.name}</span></span>
            <button 
              onClick={() => setPage('login')}
              className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-red-500 transition-colors"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-4xl mx-auto w-full p-6 flex flex-col items-center justify-center">
          <div className="w-full bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
            <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Search className="text-indigo-500" /> Nhập phương trình phản ứng
            </h2>
            
            <div className="space-y-6">
              <div className="relative">
                <textarea 
                  value={equationInput}
                  onChange={(e) => setEquationInput(e.target.value)}
                  placeholder="Ví dụ: Fe + H2SO4 -> Fe2(SO4)3 + SO2 + H2O"
                  className="w-full min-h-[120px] p-6 text-xl chem-font rounded-2xl border-2 border-slate-100 focus:border-indigo-500 outline-none transition-all resize-none bg-slate-50"
                />
                <div className="absolute top-2 right-2 text-xs font-mono text-slate-300">REDOX_INPUT</div>
              </div>

              {feedback?.type === 'error' && (
                <div className="p-4 bg-red-50 text-red-600 rounded-xl flex items-center gap-2 animate-shake">
                  <XCircle size={18} /> {feedback.message}
                </div>
              )}

              <button 
                onClick={startBalancing}
                disabled={isLoading}
                className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-indigo-700 active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-xl shadow-indigo-100 disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>Bắt đầu cân bằng <ChevronRight /></>
                )}
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <button onClick={resetAll} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
            <RotateCcw size={20} />
          </button>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-indigo-500 uppercase tracking-wider">Đang rèn luyện</span>
            <Formula text={equationInput} className="text-sm text-slate-500" />
          </div>
        </div>
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((s) => (
            <div 
              key={s} 
              className={`h-2 w-8 rounded-full transition-all ${currentStep >= s ? 'bg-indigo-500' : 'bg-slate-200'}`} 
            />
          ))}
        </div>
      </header>

      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-4xl mx-auto space-y-8 pb-24">
          <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-bold text-xl">
                {currentStep}
              </div>
              <h2 className="text-2xl font-bold text-slate-800">
                {currentStep === 1 && "Xác định số oxi hóa và Chất"}
                {currentStep === 2 && "Viết các quá trình"}
                {currentStep === 3 && "Tìm hệ số cho quá trình"}
                {currentStep === 4 && "Cân bằng phương trình"}
              </h2>
            </div>

            <div className="space-y-8">
              {currentStep === 1 && stepData && (
                <div className="space-y-12">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-4">Nhập số oxi hóa thay đổi</h3>
                    <div className="flex flex-wrap items-end gap-x-8 gap-y-12 py-4 justify-center">
                      {[...stepData.compoundsLeft, '->', ...stepData.compoundsRight].map((part, i) => {
                        if (part === '->') return <span key={i} className="text-3xl text-slate-300 mx-4">→</span>;
                        
                        const changingElInComp = stepData.elementsChanging.filter(el => 
                          (i < stepData.compoundsLeft.length && el.compoundLeft === part) ||
                          (i > stepData.compoundsLeft.length && el.compoundRight === part)
                        );

                        return (
                          <div key={i} className="flex flex-col items-center">
                            <div className="flex gap-4 mb-2">
                              {changingElInComp.map((el, idx) => {
                                const elIndex = stepData.elementsChanging.indexOf(el);
                                const key = i < stepData.compoundsLeft.length ? `left_${elIndex}` : `right_${elIndex}`;
                                const isWrong = feedback?.type === 'error' && parseInt(step1OxStates[key]) !== (i < stepData.compoundsLeft.length ? el.leftState : el.rightState);

                                return (
                                  <div key={idx} className="flex flex-col items-center relative">
                                    <span className="text-[10px] font-bold text-indigo-400 mb-1">{el.symbol}</span>
                                    <input 
                                      className={`w-10 h-10 rounded-lg border-2 text-center font-bold outline-none transition-all ${
                                        isWrong ? 'border-red-400 bg-red-50 text-red-600' : 'border-slate-100 bg-slate-50 text-indigo-600 focus:border-indigo-400'
                                      }`}
                                      placeholder="?"
                                      value={step1OxStates[key] || ''}
                                      onChange={(e) => {
                                        setStep1OxStates(prev => ({ ...prev, [key]: e.target.value }));
                                      }}
                                    />
                                    {isWrong && (
                                      <span className="absolute -bottom-5 text-[10px] font-bold text-green-600 animate-bounce">
                                        {i < stepData.compoundsLeft.length ? (el.leftState >= 0 ? `+${el.leftState}` : el.leftState) : (el.rightState >= 0 ? `+${el.rightState}` : el.rightState)}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            <div className="flex items-center">
                              {i > 0 && i !== stepData.compoundsLeft.length && <span className="mr-2 text-slate-400 font-bold">+</span>}
                              <Formula text={part} className="text-2xl" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-100">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-600 flex items-center gap-2">
                        Chất khử là:
                        {feedback?.type === 'error' && !step1Agents.reducing.toLowerCase().includes(stepData.reducingAgent.toLowerCase()) && (
                           <span className="text-xs font-bold text-green-600">(Đáp án: {stepData.reducingAgent})</span>
                        )}
                      </label>
                      <input 
                        className={`w-full p-4 rounded-xl border outline-none transition-all ${
                          feedback?.type === 'error' && !step1Agents.reducing.toLowerCase().includes(stepData.reducingAgent.toLowerCase()) 
                          ? 'border-red-200 bg-red-50 focus:ring-red-400' : 'border-slate-200 focus:ring-indigo-400'
                        }`}
                        placeholder="Nhập chất khử..."
                        value={step1Agents.reducing}
                        onChange={(e) => setStep1Agents(prev => ({ ...prev, reducing: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-600 flex items-center gap-2">
                        Chất oxi hóa là:
                        {feedback?.type === 'error' && !step1Agents.oxidizing.toLowerCase().includes(stepData.oxidizingAgent.toLowerCase()) && (
                           <span className="text-xs font-bold text-green-600">(Đáp án: {stepData.oxidizingAgent})</span>
                        )}
                      </label>
                      <input 
                        className={`w-full p-4 rounded-xl border outline-none transition-all ${
                          feedback?.type === 'error' && !step1Agents.oxidizing.toLowerCase().includes(stepData.oxidizingAgent.toLowerCase()) 
                          ? 'border-red-200 bg-red-50 focus:ring-red-400' : 'border-slate-200 focus:ring-indigo-400'
                        }`}
                        placeholder="Nhập chất oxi hóa..."
                        value={step1Agents.oxidizing}
                        onChange={(e) => setStep1Agents(prev => ({ ...prev, oxidizing: e.target.value }))}
                      />
                    </div>
                  </div>

                  {feedback?.type === 'error' && (
                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3 items-start animate-in fade-in slide-in-from-bottom-2">
                      <Info className="text-amber-500 mt-1 shrink-0" size={20} />
                      <div className="text-sm text-amber-800">
                        <p className="font-bold mb-1">Gợi ý sửa lỗi:</p>
                        <ul className="list-disc ml-4 space-y-1">
                          <li>Kiểm tra lại số oxi hóa của các nguyên tố thay đổi (đã hiển thị gợi ý màu xanh phía dưới ô nhập).</li>
                          <li>Chất khử là chất có nguyên tố tăng số oxi hóa sau phản ứng.</li>
                          <li>Chất oxi hóa là chất có nguyên tố giảm số oxi hóa sau phản ứng.</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {currentStep === 2 && stepData && (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="font-bold text-slate-700 flex items-center justify-between">
                      Viết quá trình oxi hóa:
                      <span className="text-xs font-normal text-indigo-500 italic">Lưu ý: Viết e nhường sau mũi tên</span>
                    </h3>
                    <input 
                      className="w-full p-5 chem-font text-lg rounded-2xl border-2 border-slate-100 bg-slate-50 focus:border-indigo-400 outline-none"
                      placeholder="Ví dụ: Zn -> Zn2+ + 2e"
                      value={step2OxProcess}
                      onChange={(e) => setStep2OxProcess(e.target.value)}
                    />
                  </div>
                  <div className="space-y-4">
                    <h3 className="font-bold text-slate-700">Viết quá trình khử:</h3>
                    <input 
                      className="w-full p-5 chem-font text-lg rounded-2xl border-2 border-slate-100 bg-slate-50 focus:border-indigo-400 outline-none"
                      placeholder="Ví dụ: S+6 + 2e -> S+4"
                      value={step2RedProcess}
                      onChange={(e) => setStep2RedProcess(e.target.value)}
                    />
                  </div>
                  {feedback && (
                    <div className={`p-4 rounded-xl text-sm space-y-1 ${feedback.type === 'success' ? 'bg-indigo-50' : 'bg-red-50'}`}>
                      <p className={`font-bold ${feedback.type === 'success' ? 'text-indigo-700' : 'text-red-700'}`}>Đáp án gợi ý:</p>
                      <p>Oxi hóa: <span className="chem-font font-bold">{stepData.oxidationProcess}</span></p>
                      <p>Khử: <span className="chem-font font-bold">{stepData.reductionProcess}</span></p>
                    </div>
                  )}
                </div>
              )}

              {currentStep === 3 && stepData && (
                <div className="space-y-8">
                  <p className="text-slate-600">Xác định các hệ số để thăng bằng electron (LCM):</p>
                  <div className="space-y-4 max-w-md">
                    <div className="flex items-center gap-4">
                      <div className="w-48 text-right font-medium">Hệ số quá trình OXH:</div>
                      <input 
                        type="number"
                        className="w-24 p-3 text-center border-2 border-slate-200 rounded-xl font-bold text-indigo-600"
                        value={step3Multipliers.ox}
                        onChange={(e) => setStep3Multipliers(prev => ({ ...prev, ox: e.target.value }))}
                      />
                      {feedback?.type === 'error' && <span className="text-green-600 font-bold">({stepData.multiplierOx})</span>}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-48 text-right font-medium">Hệ số quá trình KHỬ:</div>
                      <input 
                        type="number"
                        className="w-24 p-3 text-center border-2 border-slate-200 rounded-xl font-bold text-indigo-600"
                        value={step3Multipliers.red}
                        onChange={(e) => setStep3Multipliers(prev => ({ ...prev, red: e.target.value }))}
                      />
                      {feedback?.type === 'error' && <span className="text-green-600 font-bold">({stepData.multiplierRed})</span>}
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 4 && stepData && (
                <div className="space-y-8">
                  <p className="text-slate-600 italic">Nhập hệ số vào trước các chất (bỏ trống nếu hệ số là 1):</p>
                  <div className="flex flex-wrap items-center gap-4 py-8 justify-center">
                    {stepData.compoundsLeft.map((comp, i) => (
                      <React.Fragment key={`l-${i}`}>
                        <div className="flex items-center gap-2 relative">
                          <input 
                            className="w-12 h-12 text-center rounded-xl border-2 border-slate-100 bg-slate-50 font-bold text-indigo-600 outline-none focus:border-indigo-400"
                            value={step4Coeffs[i]}
                            onChange={(e) => {
                              const newCoeffs = [...step4Coeffs];
                              newCoeffs[i] = e.target.value;
                              setStep4Coeffs(newCoeffs);
                            }}
                          />
                          {feedback?.type === 'error' && (
                            <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs font-bold text-green-600">
                              {stepData.balancedCoefficients[i]}
                            </span>
                          )}
                          <Formula text={comp} className="text-2xl" />
                        </div>
                        {i < stepData.compoundsLeft.length - 1 && <span className="text-2xl text-slate-300">+</span>}
                      </React.Fragment>
                    ))}
                    <span className="text-3xl text-slate-300 mx-4">→</span>
                    {stepData.compoundsRight.map((comp, i) => {
                      const idx = i + stepData.compoundsLeft.length;
                      return (
                        <React.Fragment key={`r-${i}`}>
                          <div className="flex items-center gap-2 relative">
                            <input 
                              className="w-12 h-12 text-center rounded-xl border-2 border-slate-100 bg-slate-50 font-bold text-indigo-600 outline-none focus:border-indigo-400"
                              value={step4Coeffs[idx]}
                              onChange={(e) => {
                                const newCoeffs = [...step4Coeffs];
                                newCoeffs[idx] = e.target.value;
                                setStep4Coeffs(newCoeffs);
                              }}
                            />
                            {feedback?.type === 'error' && (
                              <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs font-bold text-green-600">
                                {stepData.balancedCoefficients[idx]}
                              </span>
                            )}
                            <Formula text={comp} className="text-2xl" />
                          </div>
                          {i < stepData.compoundsRight.length - 1 && <span className="text-2xl text-slate-300">+</span>}
                        </React.Fragment>
                      );
                    })}
                  </div>
                  {feedback && (
                    <div className={`p-6 border rounded-2xl ${feedback.type === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <p className={`font-bold mb-2 ${feedback.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>
                        {feedback.type === 'success' ? 'Phương trình đã cân bằng hoàn tất:' : 'Đáp án đúng:'}
                      </p>
                      <div className="text-2xl font-bold chem-font text-slate-800">
                        {stepData.compoundsLeft.map((c, i) => `${stepData.balancedCoefficients[i] === 1 ? '' : stepData.balancedCoefficients[i]}${c}`).join(' + ')}
                        {' -> '}
                        {stepData.compoundsRight.map((c, i) => `${stepData.balancedCoefficients[i + stepData.compoundsLeft.length] === 1 ? '' : stepData.balancedCoefficients[i + stepData.compoundsLeft.length]}${c}`).join(' + ')}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-12 pt-8 border-t border-slate-100 flex flex-col items-center gap-6">
              {feedback && (
                <div className={`flex items-center gap-3 px-6 py-4 rounded-2xl w-full max-w-md justify-center animate-in fade-in zoom-in duration-300 ${
                  feedback.type === 'success' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'
                }`}>
                  {feedback.type === 'success' ? <CheckCircle2 /> : <XCircle />}
                  <span className="font-bold text-lg">{feedback.message}</span>
                </div>
              )}

              <div className="flex gap-4 w-full justify-center">
                {currentStep === 4 && feedback?.type === 'success' ? (
                   <button 
                    onClick={resetAll}
                    className="flex items-center gap-2 bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
                  >
                    Quay lại (Làm bài mới) <RotateCcw size={18} />
                  </button>
                ) : (
                  <>
                    <button 
                      onClick={validateStep}
                      className="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100"
                    >
                      Kiểm tra
                    </button>
                    {feedback?.type === 'success' && currentStep < 4 && (
                      <button 
                        onClick={nextStep}
                        className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all flex items-center gap-2"
                      >
                        Bước tiếp theo <ChevronRight size={18} />
                      </button>
                    )}
                    {feedback?.type === 'error' && (
                       <button 
                       onClick={nextStep}
                       className="bg-slate-200 text-slate-700 px-8 py-4 rounded-2xl font-bold hover:bg-slate-300 transition-all"
                     >
                       Bỏ qua & Bước tiếp theo
                     </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-100 p-4 text-center z-10">
        <p className="text-xs text-slate-400 font-medium tracking-widest uppercase">
          Ứng dụng Rèn luyện Cân bằng Phản ứng Oxi hóa Khử
        </p>
      </footer>
    </div>
  );
};

export default App;
