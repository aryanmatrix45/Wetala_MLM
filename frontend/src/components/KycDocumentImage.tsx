import React, { useEffect, useState } from 'react';
import { ImageOff, Loader2 } from 'lucide-react';
import { api, normalizeDirectImageUrl, retryWithImageFallback } from '../services/api';

export type KycImageSource =
  | { kind: 'upload'; fileKey: string }
  | { kind: 'drive'; url: string }
  | { kind: 'local'; dataUrl: string };

export type KycImageLoadState = 'loading' | 'loaded' | 'error';

interface KycDocumentImageProps {
  source: KycImageSource;
  token: string;
  alt: string;
  className?: string;
  /** Shown instead of the built-in error message when the image cannot be loaded */
  fallback?: React.ReactNode;
  onLoadStateChange?: (state: KycImageLoadState) => void;
}

/**
 * Renders a KYC document image from any of its sources:
 * - private uploads are fetched with the auth token (they are never publicly reachable),
 * - Google Drive links are converted to a direct image URL, retried via Drive's thumbnail
 *   endpoint, and explained when the file is not shared publicly,
 * - freshly selected files are shown from their local data URL.
 */
export const KycDocumentImage: React.FC<KycDocumentImageProps> = ({
  source,
  token,
  alt,
  className,
  fallback,
  onLoadStateChange,
}) => {
  const [src, setSrc] = useState<string | null>(null);
  const [state, setState] = useState<KycImageLoadState>('loading');

  const sourceKey = source.kind === 'upload' ? source.fileKey : source.kind === 'drive' ? source.url : source.dataUrl;

  useEffect(() => {
    onLoadStateChange?.(state);
  }, [state]);

  useEffect(() => {
    setState('loading');
    setSrc(null);

    if (source.kind === 'local') {
      setSrc(source.dataUrl);
      return;
    }
    if (source.kind === 'drive') {
      setSrc(normalizeDirectImageUrl(source.url));
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    api
      .getKycFileObjectUrl(source.fileKey, token)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [source.kind, sourceKey, token]);

  if (state === 'error') {
    if (fallback !== undefined) return <>{fallback}</>;
    return (
      <div className={`kyc-image-state is-error ${className || ''}`} role="img" aria-label={`${alt} unavailable`}>
        <ImageOff size={22} aria-hidden="true" />
        <span>
          {source.kind === 'drive'
            ? 'Can’t display this Google Drive file. In Drive, set Share → General access to “Anyone with the link”, or upload the image instead.'
            : 'Image could not be loaded.'}
        </span>
      </div>
    );
  }

  return (
    <div className={`kyc-image-frame ${className || ''}`}>
      {state === 'loading' && (
        <div className="kyc-image-state">
          <Loader2 size={20} className="kyc-spin" aria-hidden="true" />
        </div>
      )}
      {src && (
        <img
          key={src}
          src={src}
          alt={alt}
          referrerPolicy="no-referrer"
          style={state === 'loaded' ? undefined : { visibility: 'hidden', position: 'absolute' }}
          onLoad={() => setState('loaded')}
          onError={(e) => {
            if (source.kind === 'drive' && retryWithImageFallback(e.currentTarget)) return;
            setState('error');
          }}
        />
      )}
    </div>
  );
};
