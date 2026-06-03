import React, { useMemo } from 'react';
import { formatEventDateRange, formatEventStatus } from '../utils/steamEvents';

function EventHero({ event }) {
  if (!event) {
    return (
      <div className="events-hero events-hero--empty glass-panel">
        <p className="events-empty-title">No featured event</p>
        <p className="events-empty-hint">
          Run Sync Steam events in Maintenance, or wait for the weekly scheduler.
        </p>
      </div>
    );
  }

  const status = formatEventStatus(event);
  const dateLabel = formatEventDateRange(event);

  return (
    <a
      className="events-hero glass-panel"
      href={event.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      {event.image && (
        <img className="events-hero-image" src={event.image} alt="" loading="lazy" />
      )}
      <div className="events-hero-body">
        {status && <span className="events-status-badge">{status}</span>}
        <h2 className="events-hero-title">{event.name}</h2>
        {dateLabel && <p className="events-hero-dates">{dateLabel}</p>}
        {event.type && <p className="events-hero-type">{event.type}</p>}
      </div>
    </a>
  );
}

function EventCard({ event }) {
  const status = formatEventStatus(event);
  const dateLabel = formatEventDateRange(event);

  return (
    <a
      className="events-card glass-panel"
      href={event.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      {event.image && (
        <img className="events-card-image" src={event.image} alt="" loading="lazy" />
      )}
      <div className="events-card-body">
        {status && <span className="events-status-badge events-status-badge--small">{status}</span>}
        <h3 className="events-card-title">{event.name}</h3>
        {dateLabel && <p className="events-card-dates">{dateLabel}</p>}
      </div>
    </a>
  );
}

export default function EventsPage({ steamEventsDoc, loading }) {
  const nextFeatured = steamEventsDoc?.nextFeatured ?? null;
  const upcoming = useMemo(() => {
    const list = steamEventsDoc?.upcoming;
    return Array.isArray(list) ? list : [];
  }, [steamEventsDoc?.upcoming]);

  if (loading) {
    return (
      <div className="events-page">
        <p className="events-loading">Loading Steam events…</p>
      </div>
    );
  }

  return (
    <div className="events-page">
      <header className="events-page-header">
        <h1 className="events-page-title">Steam Events</h1>
        <p className="events-page-desc">
          Sales and festivals from the Steam store — plus public Next Fest dates.
        </p>
      </header>

      <EventHero event={nextFeatured} />

      {upcoming.length > 0 && (
        <section className="events-upcoming">
          <h2 className="events-section-title">Upcoming</h2>
          <div className="events-grid">
            {upcoming.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
