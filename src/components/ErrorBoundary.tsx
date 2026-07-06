import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
};

type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error("[ErrorBoundary]", error);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center min-h-[40vh]">
          <AlertTriangle className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium">Não foi possível exibir este conteúdo</p>
          <p className="text-xs text-muted-foreground max-w-sm">
            Ocorreu um erro ao carregar a prévia. Você pode baixar o arquivo para visualizá-lo.
          </p>
          <Button type="button" size="sm" variant="outline" onClick={this.reset}>
            Tentar novamente
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
