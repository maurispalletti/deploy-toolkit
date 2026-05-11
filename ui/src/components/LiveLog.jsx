import { useEffect, useRef } from "react";

export default function LiveLog({ lines }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines]);

  return (
    <div ref={ref} className="live-log">
      {lines.map((line, i) => <div key={i} className="log-line">{line}</div>)}
    </div>
  );
}
