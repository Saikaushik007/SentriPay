import { useAppTheme, LIGHT_THEMES } from '../context/ThemeContext';
import type { LightThemeId } from '../context/ThemeContext';
import { Palette, GripVertical, RotateCcw } from 'lucide-react';

interface Props {
  widgetOrder: string[];
  onReorder: (order: string[]) => void;
  onResetLayout: () => void;
}

export default function ThemeAndLayoutBar({ widgetOrder, onReorder, onResetLayout }: Props) {
  const { currentTheme, setTheme } = useAppTheme();

  const moveWidget = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= widgetOrder.length) return;
    const reordered = [...widgetOrder];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(newIndex, 0, moved);
    onReorder(reordered);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
        padding: '12px 20px',
        background: 'white',
        borderRadius: 18,
        border: '1px solid #E2E8F0',
        boxShadow: '0 4px 16px -4px rgba(0,0,0,0.05)',
        marginBottom: 24
      }}
    >
      {/* 4 Light Themes Picker */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#475569' }}>
          <Palette size={16} style={{ color: currentTheme.primary }} />
          <span>Light Color Theme:</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(Object.keys(LIGHT_THEMES) as LightThemeId[]).map(key => {
            const t = LIGHT_THEMES[key];
            const isSelected = currentTheme.id === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 12px',
                  borderRadius: 10,
                  fontSize: 11,
                  fontWeight: 700,
                  border: `1.5px solid ${isSelected ? t.primary : '#E2E8F0'}`,
                  background: isSelected ? t.badgeBg : '#F8FAFC',
                  color: isSelected ? t.primary : '#64748B',
                  cursor: 'pointer',
                  transition: 'all .15s'
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.primary }} />
                {t.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Draggable / Personal Layout Reorder Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#64748B' }}>
          <GripVertical size={14} /> Personal Dashboard Layout:
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {widgetOrder.map((wid, idx) => (
            <div
              key={wid}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 8px',
                borderRadius: 8,
                background: '#F1F5F9',
                fontSize: 10,
                fontWeight: 700,
                color: '#334155',
                fontFamily: 'monospace'
              }}
            >
              <span>{wid}</span>
              {idx > 0 && (
                <button
                  onClick={() => moveWidget(idx, 'up')}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, fontSize: 10, color: '#64748B' }}
                  title="Move left"
                >
                  ◀
                </button>
              )}
              {idx < widgetOrder.length - 1 && (
                <button
                  onClick={() => moveWidget(idx, 'down')}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, fontSize: 10, color: '#64748B' }}
                  title="Move right"
                >
                  ▶
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={onResetLayout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 8px',
            borderRadius: 8,
            border: '1px solid #E2E8F0',
            background: 'white',
            fontSize: 11,
            color: '#64748B',
            cursor: 'pointer'
          }}
          title="Reset to default layout"
        >
          <RotateCcw size={11} /> Reset
        </button>
      </div>
    </div>
  );
}
