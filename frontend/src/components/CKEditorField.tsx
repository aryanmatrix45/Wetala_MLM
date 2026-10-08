import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, HelpCircle } from 'lucide-react';

interface CKEditorFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
}

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

  // Synchronize incoming value changes if updated externally
  useEffect(() => {
    if (editorInstanceRef.current && isEditorReady) {
      const currentData = editorInstanceRef.current.getData();
      if (value !== currentData && value !== undefined) {
        editorInstanceRef.current.setData(value || '');
      }
    }
  }, [value, isEditorReady]);

  return (
    <div className="ckeditor-wrapper" style={{ width: '100%', position: 'relative' }}>
      {/* CKEditor Top Bar Info */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderBottom: 'none',
          borderRadius: '8px 8px 0 0',
          fontSize: '11px',
          color: '#64748b',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Sparkles size={13} color="#2563eb" />
          <span style={{ fontWeight: 600, color: '#334155' }}>CKEditor 5 Classic</span>
          <span>• Rich Text Description</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <HelpCircle size={12} />
          <span>Supports Headings, Lists, Tables & Links</span>
        </div>
      </div>

      {/* Editor DOM Node */}
      <div
        ref={editorContainerRef}
        style={{
          display: loadError ? 'none' : 'block',
          border: '1px solid #e2e8f0',
          borderRadius: '0 0 8px 8px',
          overflow: 'hidden',
        }}
      />

      {/* Fallback Textarea if script fails to load from CDN */}
      {loadError && (
        <div style={{ padding: '8px', background: '#fff' }}>
          <p style={{ fontSize: '12px', color: '#dc2626', marginBottom: '6px' }}>
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
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontFamily: 'monospace',
              fontSize: '13px',
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
            fontSize: '13px',
            color: '#64748b',
            zIndex: 2,
          }}
        >
          <div
            style={{
              width: '16px',
              height: '16px',
              border: '2px solid #cbd5e1',
              borderTopColor: '#2563eb',
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
