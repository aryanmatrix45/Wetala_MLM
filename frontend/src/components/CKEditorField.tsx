import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, HelpCircle } from 'lucide-react';

interface CKEditorFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
}

// Text that is HTML source code (e.g. copied from a code editor), not prose
const looksLikeHtmlSource = (text: string): boolean => {
  const trimmed = text.trim();
  return trimmed.startsWith('<') && /<\/?[a-z][a-z0-9]*[\s>/]/i.test(trimmed) && /<\/[a-z][a-z0-9]*\s*>|\/>/i.test(trimmed);
};

declare global {
  interface Window {
    ClassicEditor?: any;
  }
}

export const CKEditorField: React.FC<CKEditorFieldProps> = ({
  value,
  onChange,
  placeholder = 'Write a detailed product description with headings, formatting, tables, and lists...',
  minHeight = '240px',
}) => {
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const editorInstanceRef = useRef<any | null>(null);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // 'html' shows the raw source in a textarea; the editor stays mounted but hidden
  const [mode, setMode] = useState<'visual' | 'html'>('visual');

  // Load CKEditor 5 Classic from official CDN if not already loaded
  useEffect(() => {
    let isMounted = true;

    const initEditor = () => {
      if (!editorContainerRef.current || !window.ClassicEditor || editorInstanceRef.current) {
        return;
      }

      window.ClassicEditor.create(editorContainerRef.current, {
        placeholder,
        toolbar: [
          'heading',
          '|',
          'bold',
          'italic',
          'underline',
          'link',
          '|',
          'bulletedList',
          'numberedList',
          '|',
          'insertTable',
          'blockQuote',
          '|',
          'undo',
          'redo',
        ],
        table: {
          contentToolbar: ['tableColumn', 'tableRow', 'mergeTableCells'],
        },
      })
        .then((editor: any) => {
          if (!isMounted) {
            editor.destroy();
            return;
          }
          editorInstanceRef.current = editor;

          // Set initial content
          if (value) {
            editor.setData(value);
          }

          // Pasting HTML source code inserts it as formatted content instead of literal text
          editor.editing.view.document.on(
            'clipboardInput',
            (_evt: any, data: any) => {
              const text = data.dataTransfer?.getData('text/plain') || '';
              if (looksLikeHtmlSource(text)) {
                data.content = editor.data.htmlProcessor.toView(text);
              }
            },
            { priority: 'high' }
          );

          // Listen to changes
          editor.model.document.on('change:data', () => {
            const data = editor.getData();
            onChange(data);
          });

          // Style the editor content area
          const editableElement = editor.ui.view.editable.element;
          if (editableElement) {
            editableElement.style.minHeight = minHeight;
            editableElement.style.fontSize = '14px';
            editableElement.style.lineHeight = '1.6';
            editableElement.style.fontFamily = 'inherit';
          }

          setIsEditorReady(true);
        })
        .catch((err: any) => {
          console.error('[CKEditor] Failed to initialize:', err);
          if (isMounted) setLoadError(err.message || 'Failed to initialize editor');
        });
    };

    if (window.ClassicEditor) {
      initEditor();
    } else {
      const existingScript = document.getElementById('ckeditor5-cdn-script');
      if (existingScript) {
        existingScript.addEventListener('load', initEditor);
      } else {
        const script = document.createElement('script');
        script.id = 'ckeditor5-cdn-script';
        script.src = 'https://cdn.ckeditor.com/ckeditor5/41.4.2/classic/ckeditor.js';
        script.async = true;
        script.onload = () => {
          if (isMounted) initEditor();
        };
        script.onerror = () => {
          if (isMounted) setLoadError('Unable to load CKEditor from CDN. Using standard text editor.');
        };
        document.head.appendChild(script);
      }
    }

    return () => {
      isMounted = false;
      if (editorInstanceRef.current) {
        editorInstanceRef.current.destroy().catch(() => {});
        editorInstanceRef.current = null;
      }
    };
  }, []);

  // Synchronize incoming value changes if updated externally (skipped while editing raw HTML,
  // otherwise CKEditor would rewrite the markup on every keystroke)
  useEffect(() => {
    if (mode === 'html') return;
    if (editorInstanceRef.current && isEditorReady) {
      const currentData = editorInstanceRef.current.getData();
      if (value !== currentData && value !== undefined) {
        editorInstanceRef.current.setData(value || '');
      }
    }
  }, [value, isEditorReady, mode]);

  const modeBtn = (target: 'visual' | 'html', label: string) => (
    <button
      type="button"
      onClick={() => setMode(target)}
      aria-pressed={mode === target}
      style={{
        padding: '3px 10px',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid ' + (mode === target ? 'var(--primary)' : 'var(--border-strong)'),
        background: mode === target ? 'var(--primary)' : 'var(--surface)',
        color: mode === target ? 'var(--text-inverse)' : 'var(--text-body)',
        fontSize: 'var(--fs-xs)',
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="ckeditor-wrapper" style={{ width: '100%', position: 'relative' }}>
      {/* CKEditor Top Bar Info */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          background: 'var(--surface-subtle)',
          border: '1px solid var(--border-color)',
          borderBottom: 'none',
          borderRadius: '8px 8px 0 0',
          fontSize: 'var(--fs-xs)',
          color: 'var(--text-muted)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Sparkles size={13} color="var(--primary)" />
          <span style={{ fontWeight: 600, color: 'var(--text-body)' }}>CKEditor 5 Classic</span>
          <span>• Rich Text Description</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <HelpCircle size={12} />
            <span>Paste HTML directly, or switch to HTML to edit the source</span>
          </span>
          {!loadError && (
            <span style={{ display: 'inline-flex', gap: '4px' }} role="group" aria-label="Editor mode">
              {modeBtn('visual', 'Visual')}
              {modeBtn('html', 'HTML')}
            </span>
          )}
        </div>
      </div>

      {/* Editor DOM Node */}
      <div
        ref={editorContainerRef}
        style={{
          display: loadError || mode === 'html' ? 'none' : 'block',
          border: '1px solid var(--border-color)',
          borderRadius: '0 0 8px 8px',
          overflow: 'hidden',
        }}
      />

      {/* Raw HTML source editor */}
      {mode === 'html' && !loadError && (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={'<h2>Heading</h2>\n<p>Your description…</p>'}
          spellCheck={false}
          aria-label="HTML source"
          style={{
            display: 'block',
            width: '100%',
            boxSizing: 'border-box',
            padding: '12px',
            border: '1px solid var(--border-color)',
            borderRadius: '0 0 8px 8px',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            fontSize: 'var(--fs-base)',
            lineHeight: 1.55,
            minHeight,
            resize: 'vertical',
          }}
        />
      )}

      {/* Fallback Textarea if script fails to load from CDN */}
      {loadError && (
        <div style={{ padding: '8px', background: 'var(--surface)' }}>
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--danger)', marginBottom: '6px' }}>
            {loadError}
          </p>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={8}
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'monospace',
              fontSize: 'var(--fs-base)',
              minHeight,
            }}
          />
        </div>
      )}

      {/* Loading state indicator */}
      {!isEditorReady && !loadError && (
        <div
          style={{
            position: 'absolute',
            inset: '30px 0 0 0',
            background: 'rgba(255, 255, 255, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            fontSize: 'var(--fs-base)',
            color: 'var(--text-muted)',
            zIndex: 2,
          }}
        >
          <div
            style={{
              width: '16px',
              height: '16px',
              border: '2px solid var(--border-strong)',
              borderTopColor: 'var(--primary)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <span>Initializing CKEditor 5...</span>
        </div>
      )}
    </div>
  );
};
