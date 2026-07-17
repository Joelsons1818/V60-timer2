import { TASTING_TAG_OPTIONS } from '../utils/tasting';

export function TastingControls({
  onRatingChange,
  onToggleTag,
  rating,
  tastingTags,
}) {
  return (
    <>
      <div className="control-group">
        <label>Brew Rating</label>
        <div className="rating-control" role="group" aria-label="Brew rating">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              className={`rating-button ${value <= rating ? 'active' : ''}`}
              aria-label={`${value} ${value === 1 ? 'star' : 'stars'}`}
              aria-pressed={rating === value}
              onClick={() => onRatingChange(rating === value ? 0 : value)}
            >
              ★
            </button>
          ))}
        </div>
        <p className="helper-text rating-helper">
          {rating ? `${rating} out of 5` : 'Optional'}
        </p>
      </div>

      <div className="control-group">
        <label>Cup Profile</label>
        <div className="toggle-group tasting-toggle-group">
          {TASTING_TAG_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={tastingTags.includes(option.value) ? 'active' : ''}
              aria-pressed={tastingTags.includes(option.value)}
              onClick={() => onToggleTag(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="helper-text">Select any that describe the finished cup.</p>
      </div>
    </>
  );
}
