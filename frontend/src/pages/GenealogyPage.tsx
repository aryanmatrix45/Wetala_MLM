import React, { useState, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, User, Search, GitFork, Users2, PlusCircle } from 'lucide-react';
import { api } from '../services/api';

export const GenealogyPage: React.FC = () => {
  const [treeType, setTreeType] = useState<'binary' | 'sponsor'>('binary');
  const [rootId, setRootId] = useState('MEM0001');
  const [searchInput, setSearchInput] = useState('MEM0001');
  const [treeData, setTreeData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    loadTree(rootId, treeType);
  }, [rootId, treeType]);

  const loadTree = async (id: string, type: 'binary' | 'sponsor') => {
    try {
      setLoading(true);
      if (type === 'binary') {
        const res = await api.getBinaryTree(id, 4);
        if (res.status && res.data) {
          setTreeData(res.data);
        }
      } else {
        const res = await api.getSponsorTree(id, 3);
        if (res.status && res.data) {
          setTreeData(res.data);
        }
      }
    } catch (err: any) {
      console.error('Error loading tree:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setRootId(searchInput.trim().toUpperCase());
    }
  };

  // Vacant Spot Card
  const renderEmptySlot = (leg: 'LEFT' | 'RIGHT', parentId: string) => (
    <div style={{
      width: '180px',
      padding: '16px',
      borderRadius: '14px',
      border: '2px dashed #cbd5e1',
      background: 'rgba(255, 255, 255, 0.6)',
      textAlign: 'center',
      color: '#94a3b8',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '8px',
      margin: '0 12px'
    }}>
      <div style={{
        fontSize: '11px',
        fontWeight: 800,
        color: leg === 'LEFT' ? '#2563eb' : '#059669',
        letterSpacing: '0.5px'
      }}>
        VACANT {leg}
      </div>
      <PlusCircle size={22} color="#94a3b8" />
      <span style={{ fontSize: '11px', fontWeight: 600 }}>Available Spot</span>
      <span style={{ fontSize: '10px', color: '#64748b' }}>Parent: {parentId}</span>
    </div>
  );

  // Recursive Renderer for Binary Tree
  const renderBinaryNode = (node: any, positionLabel?: string) => {
    if (!node) return null;

    const isActive = node.isActive !== false;
    const hasChildren = node.leftNode || node.rightNode;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '0 12px' }}>
        {positionLabel && (
          <div style={{
            fontSize: '11px',
            fontWeight: 800,
            textTransform: 'uppercase',
            color: positionLabel.includes('Left') ? '#2563eb' : '#059669',
            background: positionLabel.includes('Left') ? '#eff6ff' : '#ecfdf5',
            padding: '2px 10px',
            borderRadius: '9999px',
            marginBottom: '8px',
            border: `1px solid ${positionLabel.includes('Left') ? 'rgba(37, 99, 235, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`
          }}>
            {positionLabel}
          </div>
        )}

        {/* Binary Card */}
        <div
          onClick={() => {
            setRootId(node.memberId);
            setSearchInput(node.memberId);
          }}
          className={`binary-node-card ${isActive ? 'binary-node-active' : 'binary-node-inactive'}`}
          title="Click to drilldown / set as root"
        >
          {/* Top Rank Badge */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '10px'
          }}>
            <span className="node-rank-badge" style={{
              background: node.packageName === 'Elite' ? '#fdf2f8' : node.packageName === 'Premium' ? '#f5f3ff' : '#eff6ff',
              color: node.packageName === 'Elite' ? '#db2777' : node.packageName === 'Premium' ? '#7c3aed' : '#2563eb'
            }}>
              {node.packageName || 'Basic'}
            </span>

            <span style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontWeight: 700,
              color: isActive ? '#059669' : '#dc2626'
            }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: isActive ? '#10b981' : '#ef4444'
              }} />
              {isActive ? 'Active' : 'Inactive'}
            </span>
          </div>

          {/* User Icon & Name */}
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            background: isActive ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' : '#e2e8f0',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 8px',
            boxShadow: isActive ? '0 4px 10px rgba(37, 99, 235, 0.3)' : 'none'
          }}>
            <User size={20} />
          </div>

          <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>{node.name}</div>
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
        </div>

        {/* Children Render with Connector */}
        {hasChildren ? (
          <div style={{ position: 'relative', marginTop: '24px' }}>
            {/* Vertical stem from parent */}
            <div style={{
              position: 'absolute',
              top: '-24px',
              left: '50%',
              width: '2px',
              height: '24px',
              background: '#cbd5e1',
              transform: 'translateX(-50%)',
            }} />

            <div style={{ display: 'flex', justifyContent: 'center', gap: '24px' }}>
              <div>{node.leftNode ? renderBinaryNode(node.leftNode, 'Left Leg') : renderEmptySlot('LEFT', node.memberId)}</div>
              <div>{node.rightNode ? renderBinaryNode(node.rightNode, 'Right Leg') : renderEmptySlot('RIGHT', node.memberId)}</div>
            </div>
          </div>
        ) : (
          <div style={{ position: 'relative', marginTop: '24px' }}>
            <div style={{
              position: 'absolute',
              top: '-24px',
              left: '50%',
              width: '2px',
              height: '24px',
              background: '#e2e8f0',
              transform: 'translateX(-50%)',
            }} />
            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
              {renderEmptySlot('LEFT', node.memberId)}
              {renderEmptySlot('RIGHT', node.memberId)}
            </div>
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
          onClick={() => {
            setRootId(node.memberId);
            setSearchInput(node.memberId);
          }}
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
              ? 'Real-time 2-leg placement visualization: Left Leg, Right Leg, live matched BV and vacant spots.'
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

      {/* Floating HUD Toolbar */}
      <div className="filter-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', flex: 1, maxWidth: '420px' }}>
          <div className="search-input-box" style={{ flex: 1 }}>
            <Search size={16} color="#94a3b8" />
            <input
              type="text"
              placeholder="Search Member ID (e.g. MEM0001)"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <button type="submit" className="primary-btn">
            Locate Node
          </button>
        </form>

        {/* Tree Canvas Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            fontSize: '12px',
            color: '#64748b',
            background: '#f8fafc',
            padding: '6px 12px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            fontWeight: 600
          }}>
            Root: <strong style={{ color: '#0f172a' }}>{rootId}</strong>
          </div>

          <button className="outline-btn" onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))} title="Zoom In">
            <ZoomIn size={16} />
          </button>
          <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#0f172a', minWidth: '42px', textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </span>
          <button className="outline-btn" onClick={() => setZoom((z) => Math.max(0.6, z - 0.1))} title="Zoom Out">
            <ZoomOut size={16} />
          </button>
          <button className="outline-btn" onClick={() => { setZoom(1); setRootId('MEM0001'); setSearchInput('MEM0001'); }} title="Reset Tree">
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Interactive Blueprint Canvas */}
      <div className="tree-canvas-container">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '100px' }}>
            <div style={{ 
              width: '40px', 
              height: '40px', 
              border: '3px solid #e2e8f0', 
              borderTopColor: '#2563eb', 
              borderRadius: '50%', 
              animation: 'spin 0.8s linear infinite', 
              margin: '0 auto 16px' 
            }} />
            <p style={{ color: '#64748b', fontWeight: 600 }}>Calculating live {treeType} hierarchy...</p>
          </div>
        ) : treeData ? (
          <div style={{ 
            transform: `scale(${zoom})`, 
            transformOrigin: 'top center', 
            transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)', 
            display: 'flex', 
            justifyContent: 'center',
            paddingBottom: '40px'
          }}>
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
