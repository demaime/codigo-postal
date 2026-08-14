import "../styles/birds.css";

/** Bandada decorativa de fondo. Puro CSS: no llega nada de JS al cliente. */
export default function Birds() {
  return (
    <div className="birds-layer" aria-hidden="true">
      <div className="bird-container bird-container-one">
        <div className="bird bird-one" />
      </div>
      <div className="bird-container bird-container-two">
        <div className="bird bird-two" />
      </div>
      <div className="bird-container bird-container-three">
        <div className="bird bird-three" />
      </div>
      <div className="bird-container bird-container-four">
        <div className="bird bird-four" />
      </div>
    </div>
  );
}
