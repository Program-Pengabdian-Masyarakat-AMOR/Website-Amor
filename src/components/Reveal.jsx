import { useInView } from '../hooks/useInView';

// Animasi masuk (fade + slide-up) saat elemen tergulir ke viewport.
// delay (ms) untuk efek stagger antar item. Otomatis nonaktif via CSS
// bila pengguna memilih prefers-reduced-motion (lihat index.css).
export default function Reveal({ as: Tag = 'div', delay = 0, className = '', children, ...rest }) {
  const [ref, inView] = useInView();
  return (
    <Tag
      ref={ref}
      className={`reveal ${inView ? 'is-in' : ''} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      {...rest}
    >
      {children}
    </Tag>
  );
}
