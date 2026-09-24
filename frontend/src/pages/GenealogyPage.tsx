import { useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, User } from 'lucide-react';

interface TreeNode {
  id: string;
  name: string;
  package: string;
  leftBv: number;
  rightBv: number;
  left?: TreeNode;
  right?: TreeNode;
}

export const GenealogyPage: React.FC = () => {
  const [zoom, setZoom] = useState(1);

  const sampleTree: TreeNode = {
    id: 'MEM0126',
    name: 'Amit Kumar',
    package: 'Elite (35k)',
    leftBv: 45000,
    rightBv: 37500,
    left: {
      id: 'MEM0125',
      name: 'Priya Singh',
      package: 'Premium (15k)',
      leftBv: 25000,
      rightBv: 20000,
      left: {
        id: 'MEM0124',
        name: 'Neha Verma',
        package: 'Executive (6.5k)',
        leftBv: 12500,
        rightBv: 12500
      },
      right: {
        id: 'MEM0123',
        name: 'Suresh Yadav',
        package: 'Starter (3k)',
        leftBv: 5000,
        rightBv: 7500
      }
    },
    right: {
      id: 'MEM0122',
      name: 'Manish Jain',
      package: 'Premium (15k)',
      leftBv: 15000,
      rightBv: 22500,
      left: {
        id: 'MEM0121',
        name: 'Pooja Sharma',
        package: 'Starter (3k)',
        leftBv: 2500,
        rightBv: 2500
      },
      right: {
        id: 'MEM0120',
        name: 'Ramesh Kumar',
        package: 'Executive (6.5k)',
        leftBv: 10000,
        rightBv: 12500
      }
    }
  };

  const renderNode = (node: TreeNode, position?: 'Left Leg' | 'Right Leg') => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '0 16px' }}>
        {position && (
          <div style={{
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            color: position === 'Left Leg' ? '#2563eb' : '#10b981',
            marginBottom: '4px'
          }}>
            {position}
          </div>
        )}

        {/* Node Card */}
        <div style={{
          background: 'white',
          border: '2px solid #e2e8f0',
          borderRadius: '14px',
          padding: '14px 18px',
          width: '180px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
          textAlign: 'center',
          position: 'relative'
        }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            background: '#eff6ff',
            color: '#1d72fe',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 8px'
          }}>
            <User size={20} />
          </div>

          <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>{node.name}</div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#1d72fe', marginBottom: '6px' }}>{node.id}</div>
          <span style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            padding: '2px 8px',
            borderRadius: '12px',
            fontSize: '10px',
            fontWeight: 700,
            color: '#64748b'
          }}>
            {node.package}
          </span>

          {/* Left vs Right BV indicator */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '10px',
            paddingTop: '8px',
            borderTop: '1px solid #f1f5f9',
            fontSize: '11px'
          }}>
            <div>
              <span style={{ color: '#94a3b8', display: 'block', fontSize: '9px' }}>LEFT BV</span>
              <strong style={{ color: '#2563eb' }}>{node.leftBv.toLocaleString()}</strong>
            </div>
            <div>
              <span style={{ color: '#94a3b8', display: 'block', fontSize: '9px' }}>RIGHT BV</span>
              <strong style={{ color: '#10b981' }}>{node.rightBv.toLocaleString()}</strong>
            </div>
          </div>
        </div>

        {/* Downlines Branching */}
        {(node.left || node.right) && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            <div style={{ width: '2px', height: '24px', background: '#cbd5e1' }} />
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              position: 'relative',
              paddingTop: '20px'
            }}>
              {/* Connecting Horizontal Line */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: '25%',
                right: '25%',
                height: '2px',
                background: '#cbd5e1'
              }} />

              {node.left && renderNode(node.left, 'Left Leg')}
              {node.right && renderNode(node.right, 'Right Leg')}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="page-body">
      <div className="welcome-header">
        <div>
          <h1 className="page-title">Binary Genealogy Tree</h1>
          <p className="page-subtitle">Interactive visual tree showing Left / Right legs and Business Volume (BV).</p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="outline-btn" onClick={() => setZoom(z => Math.min(z + 0.1, 1.4))}>
            <ZoomIn size={16} />
          </button>
          <button className="outline-btn" onClick={() => setZoom(z => Math.max(z - 0.1, 0.6))}>
            <ZoomOut size={16} />
          </button>
          <button className="outline-btn" onClick={() => setZoom(1)}>
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Tree View Canvas */}
      <div className="dashboard-card" style={{
        overflow: 'auto',
        minHeight: '600px',
        display: 'flex',
        justifyContent: 'center',
        padding: '40px 20px',
        background: '#fcfdfd'
      }}>
        <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', transition: 'transform 0.2s' }}>
          {renderNode(sampleTree)}
        </div>
      </div>
    </div>
  );
};
