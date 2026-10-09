import React, { useState, useEffect, useRef } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  User,
  Search,
  GitFork,
  Users2,
  ArrowDownLeft,
  ArrowDownRight,
  ArrowDown,
  Maximize2,
  ArrowLeft,
  ArrowRight,
  ChevronUp,
  Home,
  ChevronRight,
  Layers,
  ArrowDownCircle,
  BarChart3,
} from 'lucide-react';
import { api } from '../services/api';

interface GenealogyPageProps {
  user?: {
    id?: string;
    memberId?: string;
    role?: string;
    name?: string;
  } | null;
  token?: string | null;
}

interface BreadcrumbItem {
  memberId: string;
  name: string;
}

export const GenealogyPage: React.FC<GenealogyPageProps> = ({ user, token }) => {
  const isRegularMember = user?.role === 'member';
  const defaultRoot = isRegularMember && user?.memberId ? user.memberId.toUpperCase() : 'MEM0001';

  const [treeType, setTreeType] = useState<'binary' | 'sponsor'>('binary');
  const [rootId, setRootId] = useState(defaultRoot);
  const [searchInput, setSearchInput] = useState(defaultRoot);
  const [selectedDepth, setSelectedDepth] = useState<number | 'all'>('all');
  const [treeData, setTreeData] = useState<any>(null);
  const [extremes, setExtremes] = useState<{
    bottomLeft: { memberId: string; name: string; depth: number } | null;
    bottomRight: { memberId: string; name: string; depth: number } | null;
  } | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { memberId: defaultRoot, name: 'Root' },
  ]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  // Drag-to-pan canvas reference
  const canvasRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  useEffect(() => {
    if (isRegularMember && user?.memberId) {
      const myId = user.memberId.toUpperCase();
      setRootId(myId);
      setSearchInput(myId);
      setBreadcrumbs([{ memberId: myId, name: user.name || 'My Root' }]);
    }
  }, [user?.memberId, isRegularMember, user?.name]);

  useEffect(() => {
    loadTree(rootId, treeType, selectedDepth);
    if (treeType === 'binary') {
      loadExtremes(rootId);
    }
  }, [rootId, treeType, selectedDepth]);

  const loadTree = async (id: string, type: 'binary' | 'sponsor', depth: number | 'all') => {
    try {
      setLoading(true);
      setErrorMessage(null);
      if (type === 'binary') {
        const depthParam = depth === 'all' ? 'all' : depth;
        const res = await api.getBinaryTree(id, depthParam, token || undefined);
        if (res.status && res.data) {
          setTreeData(res.data);
          // Update breadcrumbs with real member name if matching root
          setBreadcrumbs((prev) => {
            const index = prev.findIndex((b) => b.memberId === res.data.memberId);
            if (index >= 0) {
              const updated = [...prev];
              updated[index] = { memberId: res.data.memberId, name: res.data.name };
              return updated.slice(0, index + 1);
            }
            return [...prev, { memberId: res.data.memberId, name: res.data.name }];
          });
        } else {
          setTreeData(null);
          setErrorMessage(res.message || `No binary tree records found for node ${id}.`);
        }
      } else {
        const depthParam = depth === 'all' ? 6 : depth;
        const res = await api.getSponsorTree(id, depthParam, token || undefined);
        if (res.status && res.data) {
          setTreeData(res.data);
          setBreadcrumbs((prev) => {
            const index = prev.findIndex((b) => b.memberId === res.data.memberId);
            if (index >= 0) {
              const updated = [...prev];
              updated[index] = { memberId: res.data.memberId, name: res.data.name };
              return updated.slice(0, index + 1);
            }
            return [...prev, { memberId: res.data.memberId, name: res.data.name }];
          });
        } else {
          setTreeData(null);
          setErrorMessage(res.message || `No sponsor tree records found for node ${id}.`);
        }
      }
    } catch (err: any) {
      console.error('Error loading tree:', err);
      setTreeData(null);
      setErrorMessage(err.message || 'Error communicating with tree server.');
    } finally {
      setLoading(false);
    }
  };

  const loadExtremes = async (id: string) => {
    try {
      const res = await api.getBinaryExtremes(id, token || undefined);
      if (res.status && res.data) {
        setExtremes(res.data);
      }
    } catch (err) {
      console.warn('Could not load binary extremes:', err);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      const targetId = searchInput.trim().toUpperCase();
      drillToNode(targetId, targetId);
    }
  };

  const drillToNode = (memberId: string, name?: string) => {
    setRootId(memberId);
    setSearchInput(memberId);
    setBreadcrumbs((prev) => {
      const idx = prev.findIndex((b) => b.memberId === memberId);
      if (idx >= 0) {
        return prev.slice(0, idx + 1);
      }
      return [...prev, { memberId, name: name || memberId }];
    });
  };

  const handleBreadcrumbClick = (item: BreadcrumbItem, index: number) => {
    setRootId(item.memberId);
    setSearchInput(item.memberId);
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
  };

  const handleReset = () => {
    setZoom(1);
    setRootId(defaultRoot);
    setSearchInput(defaultRoot);
    setBreadcrumbs([{ memberId: defaultRoot, name: 'Root' }]);
    setErrorMessage(null);
    if (canvasRef.current) {
      canvasRef.current.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    }
  };

  // Canvas Scrolling & Auto-Fit Helpers
  const scrollToFarLeft = () => {
    if (canvasRef.current) {
      canvasRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    }
  };

  const scrollToFarRight = () => {
    if (canvasRef.current) {
      canvasRef.current.scrollTo({ left: canvasRef.current.scrollWidth, behavior: 'smooth' });
    }
  };

  const scrollToCenter = () => {
    if (canvasRef.current) {
      const centerPos = (canvasRef.current.scrollWidth - canvasRef.current.clientWidth) / 2;
      canvasRef.current.scrollTo({ left: Math.max(0, centerPos), behavior: 'smooth' });
    }
  };

  const scrollToTop = () => {
    if (canvasRef.current) {
      canvasRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const scrollToBottom = () => {
    if (canvasRef.current) {
      canvasRef.current.scrollTo({ top: canvasRef.current.scrollHeight, behavior: 'smooth' });
    }
  };

  const handleAutoFit = () => {
    if (canvasRef.current && viewportRef.current) {
      const canvasWidth = canvasRef.current.clientWidth;
      const contentWidth = viewportRef.current.scrollWidth;
      if (contentWidth > 0 && canvasWidth > 0) {
        const ratio = (canvasWidth - 60) / contentWidth;
        const safeScale = Math.min(1.1, Math.max(0.45, Math.round(ratio * 100) / 100));
        setZoom(safeScale);
        setTimeout(scrollToCenter, 100);
      }
    }
  };

  // Drag-to-pan Canvas Event Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag on canvas background, not on interactive cards/buttons
    if ((e.target as HTMLElement).closest('.binary-node-card') || (e.target as HTMLElement).closest('button')) {
      return;
    }
    if (!canvasRef.current) return;
    isPanningRef.current = true;
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: canvasRef.current.scrollLeft,
      scrollTop: canvasRef.current.scrollTop,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanningRef.current || !canvasRef.current) return;
    e.preventDefault();
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    canvasRef.current.scrollLeft = panStartRef.current.scrollLeft - dx;
    canvasRef.current.scrollTop = panStartRef.current.scrollTop - dy;
  };

  const handleMouseUp = () => {
    isPanningRef.current = false;
  };

  // Compute live statistics for current loaded tree
  const computeStats = (rootNode: any) => {
    if (!rootNode) return { totalCount: 0, maxDepth: 0, leftCount: 0, rightCount: 0, leftBv: 0, rightBv: 0 };
    let totalCount = 0;
    let maxDepth = 0;
    let leftCount = 0;
    let rightCount = 0;

    const traverse = (node: any, depth: number, leg?: 'L' | 'R') => {
      if (!node) return;
      totalCount++;
      if (depth > maxDepth) maxDepth = depth;
      if (leg === 'L') leftCount++;
      if (leg === 'R') rightCount++;

      if (node.leftNode) traverse(node.leftNode, depth + 1, leg || 'L');
      if (node.rightNode) traverse(node.rightNode, depth + 1, leg || 'R');
    };

    traverse(rootNode, 1);
    return {
      totalCount,
      maxDepth,
      leftCount,
      rightCount,
      leftBv: rootNode.leftBv || 0,
      rightBv: rootNode.rightBv || 0,
    };
  };

  const treeStats = computeStats(treeData);

  // Recursive Renderer for Binary Tree (Connected directional branches, real members only)
  const renderBinaryNode = (node: any, level: number = 1) => {
    if (!node) return null;

    const isActive = node.isActive !== false;
    const hasLeft = Boolean(node.leftNode);
    const hasRight = Boolean(node.rightNode);
    const hasChildren = hasLeft || hasRight;
    const hasMoreDownline = Boolean(node.hasMoreDownline);

    return (
      <div className="tree-node-wrapper">
        {/* Binary Card */}
        <div
          onClick={() => drillToNode(node.memberId, node.name)}
          className={`binary-node-card ${isActive ? 'binary-node-active' : 'binary-node-inactive'}`}
          title="Click to drill down / focus this node as root"
        >
          {/* Level Tag */}
          <span className="node-level-tag">
            {level === 1 ? 'Root (L1)' : `Level ${level}`}
          </span>

          {/* Top Rank Badge & Active Status */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
            marginTop: '2px'
          }}>
            <span className="node-rank-badge" style={{
              background: node.packageName === 'Elite' ? '#fdf2f8' : node.packageName === 'Premium' ? '#f5f3ff' : '#eff6ff',
              color: node.packageName === 'Elite' ? '#db2777' : node.packageName === 'Premium' ? '#7c3aed' : '#2563eb'
            }}>
              {node.packageName || 'Basic'}
            </span>

            {(() => {
              const isBinActive = node.isBinaryActive || (node.personalBv || 0) >= 100;
              const pBv = node.personalBv || 0;

              if (!isActive) {
                return (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10.5px', fontWeight: 700, color: '#dc2626' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }} />
                    Inactive
                  </span>
                );
              }

              if (isBinActive) {
                return (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10.5px', fontWeight: 700, color: '#059669' }} title={`Binary Qualified with ${pBv} BV`}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                    Binary Active
                  </span>
                );
              }

              return (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 700, color: '#d97706' }} title={`Pending 100 BV requirement (${pBv}/100 BV)`}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b' }} />
                  Needs 100 BV
                </span>
              );
            })()}
          </div>

          {/* User Icon & Name */}
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: isActive ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' : '#e2e8f0',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 6px',
            boxShadow: isActive ? '0 4px 10px rgba(37, 99, 235, 0.3)' : 'none'
          }}>
            <User size={19} />
          </div>

          <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>{node.name}</div>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginTop: '2px' }}>{node.memberId}</div>

          {/* Left / Right BV Split */}
          <div className="node-leg-bar">
            <div className="node-leg-left">
              <div>L: {node.leftBv || 0}</div>
              <div style={{ fontSize: '9px', opacity: 0.8 }}>BV</div>
            </div>
            <div className="node-leg-right">
              <div>R: {node.rightBv || 0}</div>
              <div style={{ fontSize: '9px', opacity: 0.8 }}>BV</div>
            </div>
          </div>

          {/* More Downline Indicator if cutoff by depth */}
          {hasMoreDownline && (
            <div className="node-downline-hint">
              + Has more downline (Click to view)
            </div>
          )}
        </div>

        {/* Children Render with Connectors & Directional Arrows */}
        {hasChildren && (
          <div className="tree-children-container">
            {/* Center stem down from parent */}
            <div className="tree-parent-stem">
              <div className="tree-junction-point" />
            </div>

            {/* If BOTH children are present */}
            {hasLeft && hasRight ? (
              <div className="tree-dual-branches">
                {/* Left Branch */}
                <div className="tree-branch-column left">
                  <div className="tree-branch-header">
                    <div className="tree-wing-pill left-wing">
                      <ArrowDownLeft size={13} />
                      <span>Left Wing</span>
                    </div>
                    <div className="tree-arrow-indicator left-arrow">
                      <ArrowDown size={14} />
                    </div>
                  </div>
                  {renderBinaryNode(node.leftNode, level + 1)}
                </div>

                {/* Right Branch */}
                <div className="tree-branch-column right">
                  <div className="tree-branch-header">
                    <div className="tree-wing-pill right-wing">
                      <ArrowDownRight size={13} />
                      <span>Right Wing</span>
                    </div>
                    <div className="tree-arrow-indicator right-arrow">
                      <ArrowDown size={14} />
                    </div>
                  </div>
                  {renderBinaryNode(node.rightNode, level + 1)}
                </div>
              </div>
            ) : hasLeft ? (
              /* ONLY Left Child (no vacant placeholder boxes) */
              <div className="tree-single-branch">
                <div className="tree-single-connector">
                  <div className="tree-wing-pill left-wing">
                    <ArrowDownLeft size={13} />
                    <span>Left Wing</span>
                  </div>
                  <div className="tree-arrow-indicator left-arrow">
                    <ArrowDown size={14} />
                  </div>
                </div>
                {renderBinaryNode(node.leftNode, level + 1)}
              </div>
            ) : (
              /* ONLY Right Child (no vacant placeholder boxes) */
              <div className="tree-single-branch">
                <div className="tree-single-connector">
                  <div className="tree-wing-pill right-wing">
                    <ArrowDownRight size={13} />
                    <span>Right Wing</span>
                  </div>
                  <div className="tree-arrow-indicator right-arrow">
                    <ArrowDown size={14} />
                  </div>
                </div>
                {renderBinaryNode(node.rightNode, level + 1)}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Recursive Renderer for Sponsor Tree
  const renderSponsorNode = (node: any, level: number = 1) => {
    if (!node) return null;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '0 16px' }}>
        <div
          onClick={() => drillToNode(node.memberId, node.name)}
          style={{
            background: 'white',
            border: '2px solid #10b981',
            borderRadius: '16px',
            padding: '16px 20px',
            width: '200px',
            boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.1)',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          title="Click to view referrals"
        >
          <div style={{
            fontSize: '11px',
            fontWeight: 800,
            color: '#059669',
            background: '#ecfdf5',
            padding: '2px 8px',
            borderRadius: '9999px',
            display: 'inline-block',
            marginBottom: '8px'
          }}>
            Generation Level {level}
          </div>
          <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>{node.name}</div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>{node.memberId}</div>
          <div style={{
            fontSize: '11.5px',
            color: '#10b981',
            fontWeight: 700,
            marginTop: '8px',
            paddingTop: '6px',
            borderTop: '1px solid #f1f5f9'
          }}>
            👥 {node.directReferralsCount || 0} Direct Sponsors
          </div>
        </div>

        {node.referrals && node.referrals.length > 0 && (
          <div style={{ display: 'flex', gap: '20px', marginTop: '24px', position: 'relative' }}>
            <div style={{
              position: 'absolute',
              top: '-24px',
              left: '50%',
              width: '2px',
              height: '24px',
              background: '#cbd5e1',
              transform: 'translateX(-50%)',
            }} />
            {node.referrals.map((child: any) => (
              <div key={child.memberId}>{renderSponsorNode(child, level + 1)}</div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="page-body">
      {/* Header with Tree Type Switcher */}
      <div className="welcome-header">
        <div>
          <h1 className="page-title">{treeType === 'binary' ? 'Binary Placement Tree' : 'Sponsor Genealogy Tree'}</h1>
          <p className="page-subtitle">
            {treeType === 'binary'
              ? 'Complete multi-tier binary hierarchy: view full tree till bottom, navigate extreme left & right legs, with decimal-safe BV tracking.'
              : 'Unilevel sponsor hierarchy: Direct sponsor relationships, team depth, and generational lines.'}
          </p>
        </div>

        <div style={{
          display: 'flex',
          background: '#f1f5f9',
          padding: '4px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0'
        }}>
          <button
            onClick={() => setTreeType('binary')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '9px',
              fontSize: '13px',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              background: treeType === 'binary' ? '#ffffff' : 'transparent',
              color: treeType === 'binary' ? '#2563eb' : '#64748b',
              boxShadow: treeType === 'binary' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'
            }}
          >
            <GitFork size={16} />
            <span>BINARY TREE</span>
          </button>

          <button
            onClick={() => setTreeType('sponsor')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '9px',
              fontSize: '13px',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              background: treeType === 'sponsor' ? '#ffffff' : 'transparent',
              color: treeType === 'sponsor' ? '#10b981' : '#64748b',
              boxShadow: treeType === 'sponsor' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'
            }}
          >
            <Users2 size={16} />
            <span>SPONSOR TREE</span>
          </button>
        </div>
      </div>

      {/* Floating HUD Toolbar & Search */}
      <div className="filter-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', flex: 1, maxWidth: '440px' }}>
          <div className="search-input-box" style={{ flex: 1 }}>
            <Search size={16} color="#94a3b8" />
            <input
              type="text"
              placeholder={isRegularMember ? `Search downline team (e.g. ${user?.memberId})...` : "Search Member ID (e.g. MEM0001)..."}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <button type="submit" className="primary-btn">
            Locate Node
          </button>
        </form>

        {/* Depth Selector Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Layers size={14} /> Tree Depth:
          </span>
          <div className="tree-depth-group">
            <button
              className={`tree-depth-btn ${selectedDepth === 4 ? 'active' : ''}`}
              onClick={() => setSelectedDepth(4)}
              title="Show 4 Levels"
            >
              4 Levels
            </button>
            <button
              className={`tree-depth-btn ${selectedDepth === 6 ? 'active' : ''}`}
              onClick={() => setSelectedDepth(6)}
              title="Show 6 Levels"
            >
              6 Levels
            </button>
            <button
              className={`tree-depth-btn ${selectedDepth === 8 ? 'active' : ''}`}
              onClick={() => setSelectedDepth(8)}
              title="Show 8 Levels"
            >
              8 Levels
            </button>
            <button
              className={`tree-depth-btn ${selectedDepth === 10 ? 'active' : ''}`}
              onClick={() => setSelectedDepth(10)}
              title="Show 10 Levels"
            >
              10 Levels
            </button>
            <button
              className={`tree-depth-btn ${selectedDepth === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedDepth('all')}
              title="Load Whole Binary Tree Till Bottom"
            >
              Whole Tree (All)
            </button>
          </div>
        </div>
      </div>

      {/* Extreme Navigation Shortcuts & Viewport Pan Bar */}
      <div className="tree-hud-nav-bar">
        {/* Navigation Jump Shortcuts */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="tree-shortcut-btn"
            onClick={handleReset}
            title={`Return to company root (${defaultRoot})`}
          >
            <Home size={14} /> Top Root
          </button>

          {treeData?.parentId && (
            <button
              className="tree-shortcut-btn"
              onClick={() => drillToNode(treeData.parentId)}
              title={`Go up to parent (${treeData.parentId})`}
            >
              <ChevronUp size={14} /> Up 1 Level
            </button>
          )}

          {treeType === 'binary' && extremes?.bottomLeft && (
            <button
              className="tree-shortcut-btn left-btn"
              onClick={() => drillToNode(extremes.bottomLeft!.memberId, extremes.bottomLeft!.name)}
              title={`Jump to lowest node on Left Leg: ${extremes.bottomLeft.name} (${extremes.bottomLeft.memberId})`}
            >
              <ArrowDownLeft size={14} />
              <span>Bottom Left: <strong>{extremes.bottomLeft.memberId}</strong></span>
            </button>
          )}

          {treeType === 'binary' && extremes?.bottomRight && (
            <button
              className="tree-shortcut-btn right-btn"
              onClick={() => drillToNode(extremes.bottomRight!.memberId, extremes.bottomRight!.name)}
              title={`Jump to lowest node on Right Leg: ${extremes.bottomRight.name} (${extremes.bottomRight.memberId})`}
            >
              <ArrowDownRight size={14} />
              <span>Bottom Right: <strong>{extremes.bottomRight.memberId}</strong></span>
            </button>
          )}
        </div>

        {/* Viewport Canvas Pan & Zoom Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <button
            className="outline-btn"
            onClick={scrollToFarLeft}
            title="Scroll to Extreme Left"
            style={{ padding: '6px 10px', fontSize: '12px' }}
          >
            <ArrowLeft size={14} /> Left
          </button>
          <button
            className="outline-btn"
            onClick={scrollToCenter}
            title="Scroll to Center"
            style={{ padding: '6px 10px', fontSize: '12px' }}
          >
            Center
          </button>
          <button
            className="outline-btn"
            onClick={scrollToFarRight}
            title="Scroll to Extreme Right"
            style={{ padding: '6px 10px', fontSize: '12px' }}
          >
            Right <ArrowRight size={14} />
          </button>
          <button
            className="outline-btn"
            onClick={scrollToTop}
            title="Scroll to Top (Root)"
            style={{ padding: '6px 10px', fontSize: '12px' }}
          >
            Top
          </button>
          <button
            className="outline-btn"
            onClick={scrollToBottom}
            title="Scroll to Bottom Leaves"
            style={{ padding: '6px 10px', fontSize: '12px' }}
          >
            <ArrowDownCircle size={14} /> Bottom
          </button>

          <div style={{ width: '1px', height: '22px', background: '#cbd5e1', margin: '0 4px' }} />

          <button
            className="outline-btn"
            onClick={handleAutoFit}
            title="Auto-Fit Entire Tree to Screen"
            style={{ padding: '6px 10px', fontSize: '12px', fontWeight: 700, color: '#2563eb' }}
          >
            <Maximize2 size={14} /> Fit Screen
          </button>

          <button className="outline-btn" onClick={() => setZoom((z) => Math.min(1.6, z + 0.1))} title="Zoom In">
            <ZoomIn size={15} />
          </button>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', minWidth: '38px', textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </span>
          <button className="outline-btn" onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))} title="Zoom Out">
            <ZoomOut size={15} />
          </button>
          <button className="outline-btn" onClick={handleReset} title="Reset Tree to Default">
            <RotateCcw size={15} />
          </button>
        </div>
      </div>

      {/* Interactive Breadcrumb Path */}
      {breadcrumbs.length > 0 && (
        <div className="tree-breadcrumbs-bar">
          <span style={{ color: '#64748b', fontSize: '12px', marginRight: '4px' }}>Drill Path:</span>
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.memberId + idx}>
              <button
                className="tree-crumb-btn"
                onClick={() => handleBreadcrumbClick(crumb, idx)}
                title={`Drill to ${crumb.name} (${crumb.memberId})`}
                style={{
                  color: idx === breadcrumbs.length - 1 ? '#2563eb' : '#334155',
                  borderColor: idx === breadcrumbs.length - 1 ? '#93c5fd' : '#cbd5e1',
                  background: idx === breadcrumbs.length - 1 ? '#eff6ff' : '#ffffff',
                }}
              >
                {idx === 0 && <Home size={12} />}
                <span>{crumb.name} ({crumb.memberId})</span>
              </button>
              {idx < breadcrumbs.length - 1 && <ChevronRight size={13} color="#94a3b8" />}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Live Tree Statistics Bar */}
      {treeData && (
        <div className="tree-stats-strip">
          <div className="tree-stat-item">
            <BarChart3 size={16} color="#2563eb" />
            <span style={{ color: '#64748b' }}>Network in View:</span>
            <span className="tree-stat-badge" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
              {treeStats.totalCount} Members
            </span>
          </div>

          <div className="tree-stat-item">
            <span style={{ color: '#64748b' }}>Tree Levels:</span>
            <span className="tree-stat-badge" style={{ background: '#f1f5f9', color: '#334155' }}>
              {treeStats.maxDepth} Levels Deep
            </span>
          </div>

          <div className="tree-stat-item">
            <span style={{ color: '#2563eb', fontWeight: 700 }}>Left Leg:</span>
            <span className="tree-stat-badge" style={{ background: '#eff6ff', color: '#2563eb' }}>
              {treeStats.leftCount} Nodes • {treeStats.leftBv.toLocaleString()} BV
            </span>
          </div>

          <div className="tree-stat-item">
            <span style={{ color: '#059669', fontWeight: 700 }}>Right Leg:</span>
            <span className="tree-stat-badge" style={{ background: '#ecfdf5', color: '#059669' }}>
              {treeStats.rightCount} Nodes • {treeStats.rightBv.toLocaleString()} BV
            </span>
          </div>
        </div>
      )}

      {/* Interactive Blueprint Canvas with Smooth Pan & Drag */}
      <div
        className="tree-canvas-container"
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: '120px 24px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              border: '3px solid #e2e8f0',
              borderTopColor: '#2563eb',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 16px'
            }} />
            <p style={{ color: '#64748b', fontWeight: 700, fontSize: '14px' }}>
              Loading complete {treeType} hierarchy till bottom...
            </p>
          </div>
        ) : errorMessage ? (
          <div style={{ textAlign: 'center', padding: '60px 24px', maxWidth: '520px', margin: '0 auto' }}>
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '16px',
              padding: '24px',
              color: '#991b1b',
              boxShadow: '0 4px 14px rgba(239, 68, 68, 0.08)'
            }}>
              <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '6px' }}>Tree Access Notice</div>
              <p style={{ fontSize: '13px', color: '#b91c1c', marginBottom: '16px', lineHeight: 1.4 }}>{errorMessage}</p>
              <button
                type="button"
                className="primary-btn"
                onClick={handleReset}
                style={{ padding: '8px 18px', fontSize: '12.5px' }}
              >
                Return to My Tree ({defaultRoot})
              </button>
            </div>
          </div>
        ) : treeData ? (
          <div
            className="tree-viewport-wrapper"
            ref={viewportRef}
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'top center',
              transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            {treeType === 'binary' ? renderBinaryNode(treeData) : renderSponsorNode(treeData)}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '80px', color: '#94a3b8' }}>
            No tree records found for node <strong>{rootId}</strong>.
          </div>
        )}
      </div>
    </div>
  );
};
