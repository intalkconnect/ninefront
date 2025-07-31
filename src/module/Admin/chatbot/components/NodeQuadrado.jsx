import React from 'react';
import { Handle, Position } from 'reactflow';
import PropTypes from 'prop-types';
import styles from '../styles/Nodes.module.css';

const NodeQuadrado = React.memo(({ data = {}, selected }) => {
  const {
    label = 'Sem Nome',
    type = '',
    color = '#6366f1',
    nodeType = 'text'
  } = data;

  const isStartNode = nodeType === 'start';

  return (
    <div
      className={`${styles.customNode} ${selected ? styles.selected : ''}`}
      style={{
        '--node-color': color,
        '--border-color': `${color}40`,
        cursor: 'default'
      }}

    >

      <div className={styles.nodeContent}>
        <div className={styles.nodeLabel} title={label}>
          {label}
        </div>
        {type && (
          <div className={styles.nodeType}>
            {type}
          </div>
        )}
      </div>

{!isStartNode && (
  <Handle 
    type="target" 
    position={Position.Top} 
    className={styles.nodeHandle}
    style={{ borderColor: color, cursor: 'crosshair' }}
  />
)}

<Handle
  type="source"
  position={Position.Bottom}
  className={styles.nodeHandle}
  style={{ borderColor: color }}
  isConnectable={true}
/>

    </div>
  );
});

export default NodeQuadrado;
