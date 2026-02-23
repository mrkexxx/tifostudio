
import React, { useState, useEffect } from 'react';
import { 
  Film, 
  Users, 
  LayoutDashboard, 
  Plus, 
  Trash2, 
  Sparkles, 
  Download,
  ChevronRight,
  ChevronDown,
  UserPlus,
  Copy,
  Image as ImageIcon,
  Loader2,
  Layers,
  Palette,
  SkipForward,
  CheckCircle2,
  ChevronLeft,
  Clock,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { AppView, Project, Character, Scene, ArtStyle } from './types';
import { analyzeScript, generatePromptsForScenes, describeCharacterFromImage, generateScenePreview } from './services/geminiService';

const STYLE_DETAILS: Record<ArtStyle, { label: string, desc: string }> = {
  'Cinematic': { label: 'Điện ảnh', desc: 'Góc quay rộng, chiều sâu ảnh trường, màu sắc hài hòa.' },
  'Anime/Manga': { label: 'Anime/Manga', desc: 'Nét vẽ sắc sảo, phong cách hoạt hình Nhật Bản đặc trưng.' },
  'Ghibli Style': { label: 'Ghibli Style', desc: 'Nét vẽ tay mềm mại, màu sắc thiên nhiên, hoài niệm.' },
  'Edo Period Fusion': { label: 'Edo Fusion', desc: 'Phong cách Ukiyo-e kết hợp Manga hiện đại, bối cảnh Nhật Bản cổ xưa.' },
  '3D Render/UE5': { label: '3D Render/UE5', desc: 'Đồ họa Unreal Engine 5, chi tiết vật liệu chân thực.' },
  'MV Ca Nhạc/Vibrant': { label: 'MV Ca Nhạc', desc: 'Màu sắc rực rỡ, hiệu ứng ánh sáng sân khấu, thời thượng.' },
  'Cyberpunk': { label: 'Cyberpunk', desc: 'Tương lai u tối, ánh đèn Neon, công nghệ cao.' },
  'Hoạt hình Disney': { label: 'Disney Style', desc: 'Nét vẽ mềm mại, nhân vật thân thiện, biểu cảm sống động.' },
  'Tranh sơn dầu': { label: 'Tranh sơn dầu', desc: 'Kết cấu màu vẽ, nét cọ nghệ thuật, cổ điển.' },
  'Realistic Photo': { label: 'Ảnh thực tế', desc: 'Chụp ảnh chuyên nghiệp, độ chi tiết cực cao.' }
};

const ART_STYLES = Object.keys(STYLE_DETAILS) as ArtStyle[];

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}

interface CharacterEditorProps {
  character: Character;
  onUpdate: (u: Partial<Character>) => void;
  onDelete: () => void;
}

interface SceneItemProps {
  scene: Scene;
  projectCharacters: Character[];
  onUpdate: (u: Partial<Scene>) => void;
  onDelete: () => void;
  onGeneratePreview: () => Promise<void> | void;
}

export default function App() {
  const [view, setView] = useState<AppView>(AppView.DASHBOARD);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const currentProject = projects.find(p => p.id === currentProjectId);

  // Auto-calculate target scenes when duration changes in detailed mode (1 prompt = 8s)
  useEffect(() => {
    if (currentProject?.isDetailed) {
      const totalSeconds = (currentProject.durationMinutes || 0) * 60 + (currentProject.durationSeconds || 0);
      const calculatedScenes = Math.ceil(totalSeconds / 8);
      if (calculatedScenes > 0 && calculatedScenes !== currentProject.targetScenesCount) {
        updateCurrentProject({ targetScenesCount: calculatedScenes });
      } else if (totalSeconds === 0 && currentProject.targetScenesCount !== 0) {
        updateCurrentProject({ targetScenesCount: 0 });
      }
    }
  }, [currentProject?.durationMinutes, currentProject?.durationSeconds, currentProject?.isDetailed]);

  const handleCreateProject = () => {
    const newProj: Project = {
      id: Math.random().toString(36).substr(2, 9),
      title: 'Dự án mới ' + (projects.length + 1),
      description: 'Khám phá ý tưởng mới của bạn...',
      characters: [],
      scenes: [],
      fullScript: '',
      updatedAt: Date.now(),
      targetScenesCount: 5,
      globalStyle: 'Cinematic',
      isDetailed: false,
      durationMinutes: 0,
      durationSeconds: 0
    };
    setProjects([newProj, ...projects]);
    setCurrentProjectId(newProj.id);
    setView(AppView.STUDIO);
  };

  const updateCurrentProject = (updates: Partial<Project>) => {
    if (!currentProjectId) return;
    setProjects(prev => prev.map(p => p.id === currentProjectId ? { ...p, ...updates, updatedAt: Date.now() } : p));
  };

  const handleAnalyzeScript = async () => {
    if (!currentProject || !currentProject.fullScript) {
      alert("Vui lòng nhập kịch bản ở Bước 1 trước.");
      return;
    }
    if (currentProject.isDetailed && (currentProject.targetScenesCount || 0) <= 0) {
      alert("Vui lòng nhập thời lượng phim để tính số lượng cảnh.");
      return;
    }
    setLoading(true);
    try {
      const targetScenes = currentProject.targetScenesCount || 5;
      const analyzed = await analyzeScript(currentProject.fullScript, targetScenes, currentProject.isDetailed);
      const newScenes: Scene[] = analyzed.map((s, idx) => ({
        id: Math.random().toString(36).substr(2, 9),
        order: idx,
        description: s.description || '',
        cameraAngle: s.cameraAngle || 'Medium Shot',
        lighting: s.lighting || 'Cinematic',
        durationSeconds: 8, 
        characters: [],
        generatedPrompt: ''
      }));
      updateCurrentProject({ scenes: newScenes });
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePrompts = async () => {
    if (!currentProject || currentProject.scenes.length === 0) {
      alert("Vui lòng thực hiện Bước 1 (Phân tách kịch bản) trước.");
      return;
    }
    setLoading(true);
    try {
      const updatedScenes = await generatePromptsForScenes(
        currentProject.scenes, 
        currentProject.characters,
        currentProject.globalStyle,
        currentProject.globalBackground
      );
      updateCurrentProject({ scenes: updatedScenes });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadAllPrompts = () => {
    if (!currentProject || currentProject.scenes.length === 0) return;
    
    const content = currentProject.scenes
      .map((s) => (s.generatedPrompt || "").replace(/[\r\n]+/g, " ").trim())
      .filter(prompt => prompt.length > 0)
      .join("\n");

    if (!content.trim()) {
      alert("Chưa có prompt nào được tạo để tải về.");
      return;
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `TifoStudio_${currentProject.title.replace(/\s+/g, '_')}_Prompts.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleGenerateScenePreview = async (sceneId: string) => {
    if (window.aistudio) {
      if (!(await window.aistudio.hasSelectedApiKey())) {
        await window.aistudio.openSelectKey();
      }
    }
    setLoading(true);
    try {
      const scene = currentProject?.scenes.find(s => s.id === sceneId);
      if (scene?.generatedPrompt) {
        const imageUrl = await generateScenePreview(scene.generatedPrompt);
        if (imageUrl) {
          const updatedScenes = currentProject!.scenes.map(s => s.id === sceneId ? { ...s, previewImageUrl: imageUrl } : s);
          updateCurrentProject({ scenes: updatedScenes });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden text-slate-200 bg-[#020617] font-sans">
      <nav className="w-72 bg-[#020617] border-r border-slate-900 flex flex-col">
        <div className="p-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Film className="text-white" size={20} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter text-white uppercase">TIFO STUDIO</h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-none">AI Storyboard Engine</p>
            </div>
          </div>
        </div>

        <div className="flex-1 px-4 space-y-2 mt-4">
          <NavItem icon={<LayoutDashboard size={18}/>} label="Bảng điều khiển" active={view === AppView.DASHBOARD} onClick={() => setView(AppView.DASHBOARD)} />
          {currentProjectId && (
            <>
              <div className="h-px bg-slate-900 mx-4 my-6"></div>
              <p className="px-4 text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2">Quy trình sản xuất</p>
              <NavItem icon={<Users size={18}/>} label="B2: Nhân vật chính" active={view === AppView.CHARACTERS} onClick={() => setView(AppView.CHARACTERS)} />
              <NavItem icon={<Film size={18}/>} label="Studio & Storyboard" active={view === AppView.STUDIO} onClick={() => setView(AppView.STUDIO)} />
            </>
          )}
        </div>

        <div className="p-6 mt-auto">
          <button onClick={handleCreateProject} className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold py-3 rounded-xl transition-all text-sm shadow-xl shadow-indigo-900/20">
            <Plus size={18} /> Dự án mới
          </button>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto relative bg-[#020617] selection:bg-indigo-500/30">
        {loading && (
          <div className="absolute inset-0 bg-[#020617]/80 backdrop-blur-md z-[100] flex flex-col items-center justify-center space-y-6">
            <div className="relative">
               <div className="w-16 h-16 rounded-full border-4 border-slate-900 border-t-indigo-500 animate-spin"></div>
               <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-500" size={24} />
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-lg animate-pulse">Tifo Studio đang làm việc...</p>
              <p className="text-slate-500 text-sm mt-1">Đang tinh chỉnh tính đồng nhất và chất lượng điện ảnh.</p>
            </div>
          </div>
        )}

        {view === AppView.DASHBOARD && (
          <div className="p-12 max-w-6xl mx-auto">
            <div className="mb-12">
              <h2 className="text-4xl font-black text-white mb-2">Thư viện dự án</h2>
              <p className="text-slate-400">Nơi khởi nguồn của những thước phim nhất quán.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {projects.map(p => (
                <div key={p.id} onClick={() => { setCurrentProjectId(p.id); setView(AppView.STUDIO); }} className="group relative p-8 bg-[#0f172a] border border-slate-800 rounded-2xl cursor-pointer hover:border-indigo-500/50 hover:bg-[#1e293b]/50 transition-all shadow-2xl overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ChevronRight size={20} className="text-indigo-400" />
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-white group-hover:text-indigo-400 transition-colors uppercase">{p.title}</h3>
                  <p className="text-slate-400 text-xs mb-6 line-clamp-2 leading-relaxed">{p.description}</p>
                  <div className="flex items-center justify-between mt-auto">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{p.scenes.length} Scenes</span>
                    <span className="text-[10px] text-slate-600 italic">{new Date(p.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
              <button onClick={handleCreateProject} className="group flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-800 rounded-2xl hover:bg-[#0f172a]/30 hover:border-indigo-500/40 text-slate-500 transition-all">
                <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center mb-4 group-hover:bg-indigo-500/10 group-hover:text-indigo-400 transition-all">
                  <Plus size={28} />
                </div>
                <span className="text-sm font-bold uppercase tracking-widest">Khởi tạo Dự án</span>
              </button>
            </div>
          </div>
        )}

        {view === AppView.CHARACTERS && currentProject && (
          <div className="p-12 max-w-5xl mx-auto">
            <div className="flex justify-between items-start mb-12">
              <div>
                <h2 className="text-4xl font-black text-white flex items-center gap-4 uppercase"><Users className="text-indigo-500" size={32} /> Bước 2: Nhân vật chính</h2>
                <p className="text-slate-400 mt-3 max-w-xl">
                  Thiết lập ngoại hình cố định để AI giữ tính đồng nhất qua các cảnh quay. 
                  <span className="block mt-1 font-bold text-amber-500/80 italic text-sm">AI sẽ tự động đề xuất dựa trên kịch bản nếu bạn để trống.</span>
                </p>
              </div>
              <button onClick={() => setView(AppView.STUDIO)} className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-6 py-3 rounded-xl text-xs font-bold transition-all border border-white/10"><SkipForward size={16} /> Tiếp tục Studio</button>
            </div>
            <div className="space-y-8">
              {currentProject.characters.map((char: Character) => (
                <CharacterEditor 
                  key={char.id} 
                  character={char} 
                  onUpdate={(u) => updateCurrentProject({ characters: currentProject.characters.map(c => c.id === char.id ? {...c, ...u} : c) })} 
                  onDelete={() => updateCurrentProject({ characters: currentProject.characters.filter(c => c.id !== char.id) })} 
                />
              ))}
              <button onClick={() => updateCurrentProject({ characters: [...currentProject.characters, { id: Math.random().toString(36).substr(2,9), name: 'Nhân vật mới', age: '25', gender: 'Nam', appearance: {face:'', hair:'', body:'', lockedKeywords:''}, style: 'Cinematic', outfit: 'Âu phục hiện đại', personality: 'Tự tin, điềm đạm', token: '@char_'+Math.random().toString(36).substr(2,4) }] })} className="w-full py-6 border-2 border-dashed border-slate-800 rounded-3xl text-slate-500 flex flex-col items-center justify-center gap-2 hover:bg-[#0f172a] hover:text-indigo-400 hover:border-indigo-500/30 transition-all"><UserPlus size={24}/><span className="text-sm font-bold uppercase tracking-tighter">Thêm nhân vật chủ đạo</span></button>
            </div>
          </div>
        )}

        {view === AppView.STUDIO && currentProject && (
          <div className="flex h-full">
            <div className="flex-1 flex flex-col border-r border-slate-900 overflow-hidden bg-[#020617]">
              <div className="p-6 border-b border-slate-900 flex justify-between items-center bg-[#020617] sticky top-0 z-10">
                <div className="flex items-center gap-4">
                  <button onClick={() => setView(AppView.DASHBOARD)} className="p-2 hover:bg-slate-900 rounded-lg text-slate-400"><ChevronLeft size={20} /></button>
                  <h2 className="text-xl font-black text-white tracking-tight truncate max-w-md uppercase">{currentProject.title}</h2>
                </div>
                <div className="flex gap-3">
                  <button onClick={handleAnalyzeScript} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/20">
                    <Sparkles size={16} /> B1. Phân tách kịch bản
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-10 space-y-16">
                <section>
                  <div className="flex items-center justify-between mb-8">
                    <label className="flex items-center gap-2 text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">
                      <Layers size={14}/> Bước 1: Kịch bản & Thời lượng
                    </label>
                    <div className="flex items-center gap-6">
                      <div 
                        className={`flex items-center gap-3 px-4 py-2 rounded-xl border transition-all cursor-pointer ${currentProject.isDetailed ? 'bg-indigo-600/10 border-indigo-500/50' : 'bg-[#0f172a] border-slate-800 hover:border-slate-700'}`}
                        onClick={() => updateCurrentProject({ isDetailed: !currentProject.isDetailed })}
                      >
                        <span className={`text-[10px] font-bold uppercase ${currentProject.isDetailed ? 'text-indigo-400' : 'text-slate-500'}`}>Kịch bản chi tiết (Minh họa Voice-over)</span>
                        <button className={`transition-colors ${currentProject.isDetailed ? 'text-indigo-500' : 'text-slate-600'}`}>
                          {currentProject.isDetailed ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                        </button>
                      </div>
                      
                      {currentProject.isDetailed ? (
                        <div className="flex items-center gap-3 bg-[#0f172a] px-5 py-2.5 rounded-xl border border-indigo-500/30 shadow-lg shadow-indigo-900/10 animate-in fade-in slide-in-from-right-4">
                          <Clock size={16} className="text-indigo-400" />
                          <div className="flex items-center gap-2">
                            <div className="flex flex-col">
                               <span className="text-[8px] font-black text-slate-500 uppercase mb-1">Phút</span>
                               <input 
                                type="number" 
                                min="0"
                                className="w-12 bg-slate-900/50 border border-slate-800 rounded-lg p-2 text-indigo-400 font-black text-center outline-none focus:border-indigo-500 transition-all" 
                                value={currentProject.durationMinutes || 0} 
                                onChange={(e) => updateCurrentProject({ durationMinutes: parseInt(e.target.value) || 0 })} 
                              />
                            </div>
                            <span className="text-slate-600 font-bold mt-4">:</span>
                            <div className="flex flex-col">
                               <span className="text-[8px] font-black text-slate-500 uppercase mb-1">Giây</span>
                               <input 
                                type="number" 
                                min="0"
                                max="59"
                                className="w-12 bg-slate-900/50 border border-slate-800 rounded-lg p-2 text-indigo-400 font-black text-center outline-none focus:border-indigo-500 transition-all" 
                                value={currentProject.durationSeconds || 0} 
                                onChange={(e) => updateCurrentProject({ durationSeconds: parseInt(e.target.value) || 0 })} 
                              />
                            </div>
                          </div>
                          <div className="h-10 w-px bg-slate-800 mx-3"></div>
                          <div className="flex flex-col items-center">
                             <span className="text-[8px] font-black text-slate-500 uppercase mb-1">Tổng số Prompt</span>
                             <span className="text-lg text-indigo-400 font-black leading-none">{currentProject.targetScenesCount || 0}</span>
                             <span className="text-[7px] text-slate-600 font-bold uppercase mt-1">(8s/Prompt)</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-4 bg-[#0f172a] px-4 py-2 rounded-xl border border-slate-800">
                          <span className="text-[10px] text-slate-500 uppercase font-bold">Số lượng cảnh:</span>
                          <input 
                            type="number" 
                            className="w-12 bg-transparent text-indigo-400 font-black text-center outline-none" 
                            value={currentProject.targetScenesCount || 0} 
                            onChange={(e) => updateCurrentProject({ targetScenesCount: parseInt(e.target.value) || 0 })} 
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <textarea 
                    className="w-full h-56 bg-[#0f172a] border border-slate-800 rounded-2xl p-6 text-sm focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-700 leading-relaxed shadow-inner"
                    placeholder="Dán kịch bản chi tiết của bạn vào đây. Tifo Studio sẽ chia nhỏ nội dung bám sát từng mốc 8 giây của giọng đọc (Voice-over) để minh họa chính xác nhất..."
                    value={currentProject.fullScript}
                    onChange={(e) => updateCurrentProject({ fullScript: e.target.value })}
                  />
                </section>

                <section>
                  <label className="flex items-center gap-2 text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-8"><Palette size={14}/> Bước 3: Phong cách nghệ thuật</label>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    <div className="lg:col-span-2 space-y-4">
                      <p className="text-[10px] text-slate-500 uppercase font-black mb-4">Chọn Style Prompt</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {ART_STYLES.map(style => (
                          <button key={style} onClick={() => updateCurrentProject({ globalStyle: style })} className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden group ${currentProject.globalStyle === style ? 'bg-indigo-600 border-indigo-400 text-white shadow-xl shadow-indigo-900/40 scale-[1.02]' : 'bg-[#0f172a] border-slate-800 text-slate-400 hover:border-slate-600'}`}>
                            <div className="font-black text-[10px] mb-1 uppercase tracking-tighter leading-none">{STYLE_DETAILS[style].label}</div>
                            <p className={`text-[8px] leading-tight ${currentProject.globalStyle === style ? 'text-white/80' : 'text-slate-600 group-hover:text-slate-500'}`}>{STYLE_DETAILS[style].desc}</p>
                            {currentProject.globalStyle === style && <CheckCircle2 className="absolute top-3 right-3 text-white/40" size={14} />}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <p className="text-[10px] text-slate-500 uppercase font-black mb-4">Mô tả bối cảnh / Môi trường</p>
                      <textarea className="w-full h-full min-h-[220px] bg-[#0f172a] border border-slate-800 rounded-2xl p-5 text-sm focus:border-indigo-500 outline-none transition-all placeholder:text-slate-700 leading-relaxed" placeholder="Ví dụ: Tương lai năm 2077, Sài Gòn ngập trong ánh đèn Neon, trời đang mưa nhẹ..." value={currentProject.globalBackground || ''} onChange={(e) => updateCurrentProject({ globalBackground: e.target.value })} />
                    </div>
                  </div>
                </section>

                <section>
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
                    <div>
                      <label className="flex items-center gap-2 text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-2"><Sparkles size={14}/> Bước 4: Storyboard & Sinh Prompt</label>
                      <p className="text-slate-500 text-xs">Biến kịch bản thành các câu lệnh Prompt minh họa bám sát dòng thời gian.</p>
                    </div>
                    <div className="flex gap-3">
                      {currentProject.scenes.length > 0 && (
                        <>
                          <button onClick={handleGeneratePrompts} className="px-6 py-3 bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2 shadow-xl shadow-indigo-900/30"><Sparkles size={16} /> B4. Sinh Prompt Đồng bộ</button>
                          <button onClick={handleDownloadAllPrompts} className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 border border-slate-700"><Download size={16} /> Tải Prompt (.txt)</button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="space-y-6 pb-24">
                    {currentProject.scenes.length === 0 ? (
                      <div className="p-20 border-2 border-dashed border-slate-900 rounded-3xl flex flex-col items-center justify-center text-slate-700"><Film size={48} className="mb-4 opacity-20" /><p className="text-sm font-bold uppercase tracking-widest">Chưa có phân cảnh nào</p></div>
                    ) : (
                      currentProject.scenes.map((scene: Scene, idx: number) => (
                        <SceneItem key={scene.id} scene={scene} projectCharacters={currentProject.characters} onGeneratePreview={() => handleGenerateScenePreview(scene.id)} onUpdate={(u) => { const newScenes = [...currentProject.scenes]; newScenes[idx] = { ...scene, ...u }; updateCurrentProject({ scenes: newScenes }); }} onDelete={() => updateCurrentProject({ scenes: currentProject.scenes.filter(s => s.id !== scene.id) })} />
                      ))
                    )}
                  </div>
                </section>
              </div>
            </div>

            <div className="w-80 bg-[#020617] overflow-y-auto hidden lg:block border-l border-slate-900 p-8">
               <div className="mb-10">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">Database Nhân vật</h4>
                <div className="space-y-4">
                  {currentProject.characters.length === 0 ? (
                    <div className="p-4 bg-indigo-950/20 border border-indigo-900/30 rounded-xl"><p className="text-[10px] text-indigo-400 leading-relaxed font-medium italic">"Không có nhân vật thủ công. AI sẽ tự tưởng tượng ngoại hình dựa trên kịch bản."</p></div>
                  ) : (
                    currentProject.characters.map(char => (
                      <div key={char.id} className="group p-4 bg-[#0f172a] border border-slate-800 rounded-2xl hover:border-indigo-500/30 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-indigo-500 font-black border border-slate-800 shadow-inner overflow-hidden">{char.imageUrl ? <img src={char.imageUrl} className="w-full h-full object-cover" /> : char.name[0]}</div>
                          <div className="flex-1 min-w-0"><p className="text-xs font-black text-white truncate uppercase tracking-tighter">{char.name}</p><p className="text-[9px] text-indigo-500 font-mono font-bold mt-0.5">{char.token}</p></div>
                          <button onClick={() => { navigator.clipboard.writeText(char.token); alert("Đã copy token: " + char.token); }} className="p-2 text-slate-600 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all"><Copy size={14}/></button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="h-px bg-slate-900 my-8"></div>
              <div>
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Tiến độ dự án</h4>
                <div className="p-5 bg-slate-900/40 rounded-2xl border border-slate-900">
                  <div className="flex justify-between text-[10px] mb-2 font-bold uppercase tracking-widest">
                    <span className="text-slate-500">Prompt Ready</span>
                    <span className="text-indigo-400">{currentProject.scenes.filter(s => !!s.generatedPrompt).length} / {currentProject.scenes.length}</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 transition-all duration-500" style={{ width: `${(currentProject.scenes.filter(s => !!s.generatedPrompt).length / (currentProject.scenes.length || 1)) * 100}%` }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, active, onClick }) => {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all group ${active ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 shadow-lg shadow-indigo-900/10' : 'text-slate-500 hover:bg-slate-900/50 hover:text-slate-300'}`}>
      <span className={`${active ? 'text-indigo-400' : 'text-slate-600 group-hover:text-slate-400'} transition-colors`}>{icon}</span>
      <span className="font-black text-xs uppercase tracking-tighter">{label}</span>
    </button>
  );
}

const CharacterEditor: React.FC<CharacterEditorProps> = ({ character, onUpdate, onDelete }) => {
  const [analyzing, setAnalyzing] = useState(false);
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setAnalyzing(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      onUpdate({ imageUrl: base64 });
      try {
        const res = await describeCharacterFromImage(base64.split(',')[1], file.type);
        if (res) onUpdate(res);
      } finally { setAnalyzing(false); }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={onDelete} className="text-slate-700 hover:text-red-500 transition-colors p-2"><Trash2 size={20}/></button></div>
      <div className="flex flex-col md:flex-row gap-10">
        <div className="w-full md:w-56 space-y-6">
          <div className="aspect-[4/5] bg-[#020617] rounded-3xl border-2 border-dashed border-slate-800 flex flex-col items-center justify-center relative overflow-hidden hover:border-indigo-500/40 transition-all cursor-pointer shadow-inner">
            {analyzing && <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-10"><Loader2 className="animate-spin text-indigo-500 mb-2"/><p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Đang phân tích...</p></div>}
            {character.imageUrl ? <img src={character.imageUrl} className="w-full h-full object-cover" /> : <div className="text-center p-6"><ImageIcon size={32} className="text-slate-800 mx-auto mb-3"/><p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest leading-relaxed">Tải ảnh nhân vật</p></div>}
            <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] block mb-2 px-1">Tên & Token</label>
              <input className="w-full bg-[#020617] border border-slate-800 rounded-xl p-3 text-xs font-black text-white focus:border-indigo-500 outline-none" value={character.name} onChange={(e) => onUpdate({name: e.target.value})} placeholder="Tên nhân vật" />
              <input className="w-full bg-[#020617] border border-slate-800 rounded-xl p-3 text-xs font-mono text-indigo-400 mt-2 focus:border-indigo-500 outline-none" value={character.token} onChange={(e) => onUpdate({token: e.target.value})} placeholder="Token (v.d: @main_char)" />
            </div>
          </div>
        </div>
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div><label className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] block mb-2 px-1">Diện mạo & Khuôn mặt</label><textarea className="w-full bg-[#020617] border border-slate-800 rounded-2xl p-4 text-xs h-32 leading-relaxed focus:border-indigo-500 outline-none transition-all" placeholder="Chi tiết khuôn mặt..." value={character.appearance.face} onChange={(e) => onUpdate({appearance:{...character.appearance, face: e.target.value}})} /></div>
            <div><label className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] block mb-2 px-1">Trang phục</label><textarea className="w-full bg-[#020617] border border-slate-800 rounded-2xl p-4 text-xs h-32 leading-relaxed focus:border-indigo-500 outline-none transition-all" placeholder="Quần áo đặc trưng..." value={character.outfit} onChange={(e) => onUpdate({outfit: e.target.value})} /></div>
          </div>
          <div className="space-y-6">
            <div><label className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] block mb-2 px-1">Kiểu tóc</label><textarea className="w-full bg-[#020617] border border-slate-800 rounded-2xl p-4 text-xs h-32 leading-relaxed focus:border-indigo-500 outline-none transition-all" placeholder="Kiểu tóc và màu sắc..." value={character.appearance.hair} onChange={(e) => onUpdate({appearance:{...character.appearance, hair: e.target.value}})} /></div>
            <div><label className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] block mb-2 px-1">Tính cách / Thần thái</label><textarea className="w-full bg-[#020617] border border-slate-800 rounded-2xl p-4 text-xs h-32 leading-relaxed focus:border-indigo-500 outline-none transition-all" placeholder="Thần thái của nhân vật..." value={character.personality} onChange={(e) => onUpdate({personality: e.target.value})} /></div>
          </div>
        </div>
      </div>
    </div>
  );
}

const SceneItem: React.FC<SceneItemProps> = ({ scene, projectCharacters, onUpdate, onDelete, onGeneratePreview }) => {
  const [expanded, setExpanded] = useState(false);
  const toggleChar = (id: string) => { const has = scene.characters.includes(id); onUpdate({ characters: has ? scene.characters.filter(cid => cid !== id) : [...scene.characters, id] }); };
  return (
    <div className={`bg-[#0f172a] border rounded-3xl overflow-hidden transition-all duration-300 ${expanded ? 'border-indigo-500/40 ring-4 ring-indigo-500/5' : 'border-slate-800'}`}>
      <div className="p-5 flex items-center gap-6 cursor-pointer hover:bg-slate-900/50" onClick={() => setExpanded(!expanded)}>
        <div className="w-12 h-12 flex items-center justify-center bg-indigo-500/10 rounded-2xl text-indigo-400 font-black text-sm shadow-inner border border-indigo-500/20">{scene.order + 1}</div>
        <div className="flex-1 min-w-0"><p className="text-sm font-black text-white line-clamp-1 uppercase tracking-tighter">{scene.description}</p><div className="flex gap-4 mt-1"><span className="text-[10px] text-slate-500 font-bold uppercase">{scene.cameraAngle}</span><span className="text-[10px] text-slate-500 font-bold uppercase">{scene.lighting}</span>{scene.durationSeconds && <span className="text-[10px] text-indigo-400/80 font-bold uppercase tracking-widest">{scene.durationSeconds}s</span>}</div></div>
        <div className="flex items-center gap-4">{scene.previewImageUrl && <div className="w-16 h-10 rounded-lg overflow-hidden border border-slate-700 shadow-lg"><img src={scene.previewImageUrl} className="w-full h-full object-cover" /></div>}<button className="text-slate-600 hover:text-white transition-colors">{expanded ? <ChevronDown size={20}/> : <ChevronRight size={20}/>}</button></div>
      </div>
      {expanded && (
        <div className="p-8 border-t border-slate-800 bg-[#020617]/40 grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="space-y-8">
            <div><label className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] block mb-3 px-1">Mô tả chi tiết hành động minh họa</label><textarea className="w-full h-32 bg-[#020617] border border-slate-800 rounded-2xl p-5 text-sm leading-relaxed focus:border-indigo-500 outline-none transition-all" value={scene.description} onChange={(e) => onUpdate({description: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-6">
              <div><label className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] block mb-2 px-1">Góc máy</label><select className="w-full bg-[#020617] border border-slate-800 rounded-xl p-3 text-xs text-white focus:border-indigo-500 outline-none" value={scene.cameraAngle} onChange={(e) => onUpdate({cameraAngle: e.target.value})}><option>Wide Shot</option><option>Medium Shot</option><option>Close-up</option><option>Extreme Close-up</option><option>Low Angle</option><option>High Angle</option><option>Bird's Eye View</option></select></div>
              <div><label className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] block mb-2 px-1">Ánh sáng</label><select className="w-full bg-[#020617] border border-slate-800 rounded-xl p-3 text-xs text-white focus:border-indigo-500 outline-none" value={scene.lighting} onChange={(e) => onUpdate({lighting: e.target.value})}><option>Cinematic</option><option>Natural Light</option><option>Neon / Futuristic</option><option>Hard Lighting (Noir)</option><option>Soft Lighting</option><option>Golden Hour</option><option>Moonlight</option></select></div>
            </div>
            {projectCharacters.length > 0 && (
              <div><label className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] block mb-3 px-1">Nhân vật xuất hiện</label><div className="flex flex-wrap gap-2">{projectCharacters.map(c => (<button key={c.id} onClick={() => toggleChar(c.id)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter border transition-all ${scene.characters.includes(c.id) ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-900/40' : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700'}`}>{c.name}</button>))}</div></div>
            )}
            <button onClick={onDelete} className="text-red-900 hover:text-red-500 text-[9px] font-black uppercase tracking-widest transition-colors flex items-center gap-2"><Trash2 size={12}/> Xóa cảnh</button>
          </div>
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-[#0f172a] p-3 rounded-xl border border-slate-800"><label className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em]">KẾT QUẢ PROMPT</label><button onClick={() => onGeneratePreview()} className="text-[9px] font-black bg-white/5 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg transition-all border border-white/10 uppercase tracking-widest shadow-lg active:scale-95">XEM TRƯỚC (AI)</button></div>
            <div className="relative group/prompt"><textarea className="w-full h-40 bg-[#020617] border border-slate-800 rounded-2xl p-5 text-[11px] font-mono text-slate-400 leading-relaxed focus:border-indigo-500 outline-none resize-none" value={scene.generatedPrompt} readOnly placeholder="Prompt sẽ tự động sinh sau khi hoàn thành các bước..." />{scene.generatedPrompt && <button onClick={() => { navigator.clipboard.writeText(scene.generatedPrompt); alert("Đã copy Prompt!"); }} className="absolute bottom-4 right-4 p-2 bg-slate-900 hover:bg-indigo-600 rounded-lg text-slate-400 hover:text-white transition-all opacity-0 group-hover/prompt:opacity-100 shadow-xl"><Copy size={14}/></button>}</div>
            {scene.previewImageUrl ? (
              <div className="w-full aspect-video rounded-3xl overflow-hidden border border-slate-800 shadow-2xl relative group/preview"><img src={scene.previewImageUrl} className="w-full h-full object-cover transition-transform duration-700 group-hover/preview:scale-110" /><div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-end p-6"><p className="text-[10px] text-white/80 font-bold uppercase tracking-widest">Phân cảnh {scene.order + 1}</p></div></div>
            ) : (
              <div className="w-full aspect-video rounded-3xl border-2 border-dashed border-slate-900 flex flex-col items-center justify-center text-slate-800 bg-slate-950/40"><ImageIcon size={32} className="mb-2 opacity-10" /><p className="text-[10px] font-black uppercase tracking-widest opacity-20">Preview Area</p></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
