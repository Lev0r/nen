import React from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function GameCard({ game }) {
  const { userIndex } = useAuth();
  
  // Dummy styling based on score
  const getScoreColor = (score) => {
    if (score >= 80) return 'var(--accent-mint)';
    if (score >= 50) return 'var(--accent-yellow)';
    return 'var(--accent-red)';
  };

  const scoreColor = getScoreColor(game.matchScore);
  const steamUrl = game.url || `https://store.steampowered.com/app/${game.id}/`;

  return (
    <div 
      className="glass-panel animate-fade-in" 
      style={{ 
        position: 'relative', 
        overflow: 'hidden',
        boxShadow: game.ruDeveloperAlert ? 'var(--shadow-neon-red)' : '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Thumbnail */}
      <a href={steamUrl} target="_blank" rel="noreferrer" style={{ position: 'relative', height: '160px', width: '100%', display: 'block', textDecoration: 'none' }}>
        <img 
          src={game.thumbnail} 
          alt={game.name} 
          style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s' }}
          onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
        />
        
        {/* Match Score Radial Ring */}
        <div style={{
          position: 'absolute',
          bottom: '-20px',
          right: '20px',
          width: '50px',
          height: '50px',
          borderRadius: '50%',
          background: `conic-gradient(${scoreColor} ${game.matchScore}%, #1e293b 0)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 0 10px ${scoreColor}`,
          zIndex: 10
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: 'var(--bg-dark)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.85rem',
            fontWeight: 'bold',
            color: '#fff'
          }}>
            {game.matchScore}%
          </div>
        </div>
      </a>

      {/* Card Body */}
      <div style={{ padding: '1.5rem', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <a href={steamUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
          <h3 style={{ marginBottom: '0.25rem', color: '#fff', fontSize: '1.1rem' }}>{game.name}</h3>
        </a>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
          {game.isOnSale ? <span style={{color: 'var(--accent-mint)'}}>{game.price} (SALE)</span> : game.price}
        </p>

        {/* Detailed Info Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0.5rem',
          fontSize: '0.8rem',
          color: 'var(--text-muted)',
          marginBottom: '1rem',
          background: 'rgba(0,0,0,0.2)',
          padding: '0.5rem',
          borderRadius: '8px'
        }}>
          <div>
            <strong>Status:</strong> {game.developmentStatus}
          </div>
          <div>
            <strong>Version:</strong> {game.currentVersion || 'N/A'}
          </div>
          <div>
            <strong>You:</strong> <span style={{color: game.owned[`user${userIndex}`] ? 'var(--accent-mint)' : 'var(--text-muted)'}}>{game.owned[`user${userIndex}`] ? 'Owned' : 'Wishlist'}</span> (Hype: {game.hype[`user${userIndex}`]})
          </div>
          <div>
            <strong>Friend:</strong> <span style={{color: game.owned[`user${userIndex === 0 ? 1 : 0}`] ? 'var(--accent-mint)' : 'var(--text-muted)'}}>{game.owned[`user${userIndex === 0 ? 1 : 0}`] ? 'Owned' : 'Wishlist'}</span> (Hype: {game.hype[`user${userIndex === 0 ? 1 : 0}`]})
          </div>
        </div>
        
        {/* Tags */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: 'auto' }}>
          {game.coopSpecs?.onlineCoop && (
            <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', background: 'rgba(59, 130, 246, 0.2)', color: 'var(--accent-blue)', borderRadius: '4px' }}>Online Co-op</span>
          )}
          {game.tags?.map(tag => (
            <span key={tag} style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', background: 'rgba(255, 255, 255, 0.05)', color: '#cbd5e1', borderRadius: '4px' }}>
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
