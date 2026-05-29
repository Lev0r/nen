import React from 'react';

export default function GameCard({ game }) {
  // Dummy styling based on score
  const getScoreColor = (score) => {
    if (score >= 80) return 'var(--accent-mint)';
    if (score >= 50) return 'var(--accent-yellow)';
    return 'var(--accent-red)';
  };

  const scoreColor = getScoreColor(game.matchScore);

  return (
    <div 
      className="glass-panel animate-fade-in" 
      style={{ 
        position: 'relative', 
        overflow: 'hidden',
        boxShadow: game.ruDeveloperAlert ? 'var(--shadow-neon-red)' : '0 8px 32px 0 rgba(0, 0, 0, 0.3)'
      }}
    >
      {/* Thumbnail */}
      <div style={{ position: 'relative', height: '160px', width: '100%' }}>
        <img 
          src={game.thumbnail} 
          alt={game.name} 
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        
        {/* Match Score Radial Ring (Simplified for now using border radius & conic gradient) */}
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
          boxShadow: `0 0 10px ${scoreColor}`
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
      </div>

      {/* Card Body */}
      <div style={{ padding: '1.5rem' }}>
        <h3 style={{ marginBottom: '0.5rem', color: '#fff' }}>{game.name}</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
          {game.isOnSale ? <span style={{color: 'var(--accent-mint)'}}>{game.price} (SALE)</span> : game.price}
        </p>
        
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {game.coopSpecs.onlineCoop && (
            <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', background: 'rgba(59, 130, 246, 0.2)', color: 'var(--accent-blue)', borderRadius: '4px' }}>Online Co-op</span>
          )}
          {game.tags.map(tag => (
            <span key={tag} style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px' }}>
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
