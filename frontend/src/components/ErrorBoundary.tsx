import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  label?: string;
}

interface State {
  hasError: boolean;
  errorMsg: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMsg: error?.message || 'Unknown error' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.label ?? 'widget'}]`, error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          borderRadius: 16,
          padding: '20px 24px',
          background: '#FFF1F2',
          border: '1px solid #FECDD3',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          color: '#BE123C',
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>
              {this.props.label ? `${this.props.label} ` : ''}Couldn't load
            </div>
            <div style={{ fontSize: 12, marginTop: 2, color: '#9F1239', fontFamily: 'monospace' }}>
              {this.state.errorMsg}
            </div>
          </div>
          <button
            onClick={() => this.setState({ hasError: false, errorMsg: '' })}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 10,
              background: '#FFF1F2', border: '1px solid #FECDD3',
              color: '#BE123C', fontSize: 12, fontWeight: 700, cursor: 'pointer'
            }}
          >
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
