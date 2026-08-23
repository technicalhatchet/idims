import { Component } from 'react';
import Link from 'next/link';

export default class SolomonErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[Solomon] Page error:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="min-h-screen bg-[#0A0F1E] text-white px-5 py-8 max-w-lg mx-auto pt-[max(2rem,env(safe-area-inset-top))]">
          <h1 className="text-lg font-semibold text-red-300">Something went wrong</h1>
          <p className="text-sm text-gray-400 mt-2">
            {this.state.error?.message || 'This page hit an error. Your diagnostic may still be saved on device.'}
          </p>
          <div className="flex flex-col gap-2 mt-6">
            <Link href="/solomon/diagnostics" className="rounded-xl bg-[#0089B9] px-4 py-3 text-center font-medium">
              My diagnostics
            </Link>
            <Link href="/solomon" className="rounded-xl border border-white/20 px-4 py-3 text-center">
              Solomon home
            </Link>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
