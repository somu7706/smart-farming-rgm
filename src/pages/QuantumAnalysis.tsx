import { useState } from "react";
import { Atom, Loader2 } from "lucide-react";

const QuantumAnalysis = () => {
    const [loading, setLoading] = useState(true);

    return (
        <div className="flex flex-col h-[calc(100vh-120px)] animate-fade-in">
            <div className="flex items-center gap-3 mb-1">
                <Atom className="w-6 h-6 text-primary animate-pulse" />
                <h1 className="text-2xl font-display font-bold text-foreground">Quantum Crop Intelligence</h1>
                <span className="px-2 py-0.5 bg-primary/20 text-primary text-[10px] font-bold uppercase rounded-full">Experimental</span>
            </div>
            <p className="text-sm text-muted-foreground mb-6">Advanced predictive modeling powered by quantum analysis</p>

            <div className="flex-1 relative bg-card rounded-xl border border-border overflow-hidden shadow-soft">
                {loading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 z-10 backdrop-blur-sm">
                        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
                        <p className="font-semibold text-sm text-foreground">Loading Quantum Engine...</p>
                        <p className="text-xs text-muted-foreground mt-1">Initializing secure Streamlit connection</p>
                    </div>
                )}

                <iframe
                    src="https://vasavi-bzymsxfoni6ut9eiknpmwf.streamlit.app/?embed=true"
                    width="100%"
                    height="100%"
                    className="w-full h-full border-none"
                    onLoad={() => setLoading(false)}
                    allow="camera; microphone; clipboard-read; clipboard-write;"
                    sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals"
                    title="Quantum Analysis App"
                />

                {/* Fallback Error message after 20 seconds if still loading */}
                {loading && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground bg-background/50 px-2 py-1 rounded">
                        If the engine doesn't load, check your internet connection or third-party cookie settings.
                    </div>
                )}
            </div>
        </div>
    );
};

export default QuantumAnalysis;
