import { useEditor, type Panel } from '../../store/editor';
import { Icon } from '../components/ui';
import { AIPanel } from './AIPanel';
import { CaptionsPanel } from './CaptionsPanel';
import { ColorPanel } from './ColorPanel';
import { SoundtrackPanel } from './SoundtrackPanel';
import { MotionEditPanel, MotionPanel } from './MotionPanels';
import { AnimationPanel, BlendPanel, ChromaPanel, KeyframesPanel, MaskPanel, SpeedPanel, TransformPanel, TransitionPanel, VoicePanel, VolumePanel } from './ClipPanels';
import { ExportPanel } from './ExportPanel';
import { AdjustPanel, EffectsPanel, FiltersPanel } from './LookPanels';
import { AudioPanel, BackgroundPanel, FormatPanel, MediaPanel, OverlayPanel, RecordPanel, StickersPanel } from './MediaPanels';
import { TextEditPanel, TextPanel } from './TextPanels';

const TITLES: Partial<Record<Exclude<Panel, null>, string>> = {
  media: 'Mídia', audio: 'Áudio', text: 'Texto', textEdit: 'Editar texto', captions: 'Legendas', effects: 'Efeitos', filters: 'Filtros',
  adjust: 'Ajustes de cor', transition: 'Transição', speed: 'Velocidade', volume: 'Volume', animation: 'Animação', transform: 'Transformar',
  mask: 'Máscara', chroma: 'Chroma key', blend: 'Mesclagem', ai: 'Ferramentas de IA', format: 'Formato', background: 'Fundo',
  export: 'Exportar', color: 'Correção de cor', motion: 'Motion graphics', motionEdit: 'Editar gráfico', soundtrack: 'Trilha sonora com IA', keyframes: 'Keyframes', voice: 'Efeitos de voz', stickers: 'Stickers', overlay: 'Sobreposição', record: 'Narração',
};

export default function Panels() {
  const panel = useEditor((s) => s.panel);
  if (!panel) return null;
  const body = (() => {
    switch (panel) {
      case 'media': return <MediaPanel />;
      case 'overlay': return <OverlayPanel />;
      case 'audio': return <AudioPanel />;
      case 'record': return <RecordPanel />;
      case 'stickers': return <StickersPanel />;
      case 'format': return <FormatPanel />;
      case 'background': return <BackgroundPanel />;
      case 'text': return <TextPanel />;
      case 'textEdit': return <TextEditPanel />;
      case 'captions': return <CaptionsPanel />;
      case 'effects': return <EffectsPanel />;
      case 'filters': return <FiltersPanel />;
      case 'adjust': return <AdjustPanel />;
      case 'color': return <ColorPanel />;
      case 'motion': return <MotionPanel />;
      case 'motionEdit': return <MotionEditPanel />;
      case 'soundtrack': return <SoundtrackPanel />;
      case 'transition': return <TransitionPanel />;
      case 'speed': return <SpeedPanel />;
      case 'volume': return <VolumePanel />;
      case 'voice': return <VoicePanel />;
      case 'animation': return <AnimationPanel />;
      case 'transform': return <TransformPanel />;
      case 'mask': return <MaskPanel />;
      case 'chroma': return <ChromaPanel />;
      case 'blend': return <BlendPanel />;
      case 'keyframes': return <KeyframesPanel />;
      case 'ai': return <AIPanel />;
      case 'export': return <ExportPanel />;
      default: return <div className="hint">Em breve</div>;
    }
  })();
  return (
    <div className="sheet" role="dialog" aria-label={TITLES[panel] ?? ''} data-testid={`panel-${panel}`}>
      <div className="sheet-grip" />
      <div className="sheet-head">
        <h3>{TITLES[panel] ?? ''}</h3>
        <button className="icon-btn" onClick={() => useEditor.getState().openPanel(null)} aria-label="Fechar painel" data-testid="close-panel"><Icon name="check" /></button>
      </div>
      <div className="sheet-body">{body}</div>
    </div>
  );
}
