import { useState, useRef } from "react";
import { Upload, Camera, ScanLine, Loader2, AlertTriangle, CheckCircle, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ScanResult {
  disease: string;
  confidence: number;
  severity: string;
  symptoms: string[];
  treatment: string;
  prevention: string;
}

const CropScanner = () => {
  const [selectedCrop, setSelectedCrop] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      setCameraStream(stream);
      setIsCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      toast.error("Camera access required for scanning. Please check permissions.");
      console.error("Camera error:", err);
    }
  };

  const closeCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
    }
    setCameraStream(null);
    setIsCameraOpen(false);
  };

  const compressImage = (dataUrl: string, callback: (compUrl: string, base64: string) => void) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 600;
      let width = img.width;
      let height = img.height;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        const comp = canvas.toDataURL("image/jpeg", 0.75);
        callback(comp, comp.split(",")[1]);
      } else {
        callback(dataUrl, dataUrl.split(",")[1]);
      }
    };
    img.src = dataUrl;
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const rawUrl = canvas.toDataURL("image/jpeg", 0.85);
        compressImage(rawUrl, (compUrl, base64) => {
          setImagePreview(compUrl);
          setImageBase64(base64);
          setResult(null);
          closeCamera();
          toast.success("Image captured!");
        });
      }
    }
  };

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const rawUrl = e.target?.result as string;
      compressImage(rawUrl, (compUrl, base64) => {
        setImagePreview(compUrl);
        setImageBase64(base64);
        setResult(null);
      });
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!imageBase64) {
      toast.error("Please upload an image first");
      return;
    }
    setLoading(true);
    setResult(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      // Fast Python AI Crop Pathology engine on Render
      const response = await fetch("https://smart-farming-rgm.onrender.com/api/crop-guidance/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageBase64 }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const symptomsList = data.advisory?.symptoms || ["Visible lesions or discoloration on leaves"];
        const chem = data.advisory?.treatment_plan?.chemical_solution || "Apply recommended copper-based fungicide";
        const org = data.advisory?.treatment_plan?.organic_solution || "Neem oil spray (5ml/L)";
        const prev = Array.isArray(data.advisory?.prevention_tips)
          ? data.advisory.prevention_tips.join(". ")
          : (data.advisory?.prevention || "Maintain good soil drainage and practice crop rotation.");

        setResult({
          disease: `${data.crop_name || "Crop"} - ${data.disease_name || "Detected Condition"}`,
          confidence: Math.round((data.disease_confidence || 0.88) * 100),
          severity: data.severity || "Medium",
          symptoms: symptomsList,
          treatment: `${chem}. Organic: ${org}`,
          prevention: prev
        });
        toast.success("Analysis complete!");
        return;
      }

      const errData = await response.json().catch(() => null);
      if (errData?.detail) {
        throw new Error(errData.detail);
      }

      // Fallback to Supabase function if Render is unavailable
      const { data: supaData, error: supaError } = await supabase.functions.invoke("crop-disease-scan", {
        body: { imageBase64, cropType: selectedCrop },
      });
      if (supaError || supaData?.error) throw new Error(supaError?.message || supaData?.error || "Analysis failed");
      setResult(supaData as ScanResult);
      toast.success("Analysis complete!");
    } catch (err: any) {
      console.error(err);
      if (err.name === "AbortError") {
        toast.error("Analysis timed out. Please try again with a clearer picture.");
      } else {
        toast.error(err.message || "Failed to analyze crop");
      }
    } finally {
      setLoading(false);
    }
  };

  const severityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case "high": return "text-destructive bg-destructive/10";
      case "medium": return "text-agri-amber bg-agri-amber/10";
      case "low": return "text-agri-green bg-agri-green/10";
      default: return "text-primary bg-primary/10";
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-1">
        <ScanLine className="w-6 h-6 text-primary shrink-0" />
        <h1 className="text-xl sm:text-2xl font-display font-bold text-foreground">AI Crop Disease Scanner</h1>
        <span className="px-2 py-0.5 bg-agri-amber/20 text-agri-amber text-[10px] font-bold uppercase rounded-full">Pro AI System</span>
      </div>
      <p className="text-sm text-muted-foreground mb-6">AI detects your crop and any disease automatically from the photo.</p>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Upload Section */}
        <div className="lg:col-span-2 bg-card rounded-xl p-6 card-shadow border border-border h-fit">
          <h2 className="font-semibold text-sm mb-4">1. Capture or Upload Image</h2>

          <div className="mb-4">
            <label className="text-xs font-bold text-muted-foreground uppercase mb-1.5 block">Optional: Select Crop Type</label>
            <select
              value={selectedCrop}
              onChange={(e) => setSelectedCrop(e.target.value)}
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Auto-Detect Crop</option>
              <option value="Tomato">Tomato</option>
              <option value="Potato">Potato</option>
              <option value="Rice">Rice</option>
              <option value="Cotton">Cotton</option>
              <option value="Maize">Maize</option>
            </select>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
            }}
          />

          <div
            className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center text-center hover:border-primary/40 transition-colors cursor-pointer overflow-hidden aspect-square"
            onClick={() => fileInputRef.current?.click()}
          >
            {imagePreview ? (
              <img src={imagePreview} alt="Crop preview" className="w-full h-full rounded-lg object-cover" />
            ) : (
              <>
                <Upload className="w-10 h-10 text-muted-foreground mb-3" />
                <p className="font-semibold text-sm text-foreground">Drop crop photo here</p>
                <p className="text-xs text-muted-foreground">or click to browse</p>
              </>
            )}
          </div>

          <div className="flex gap-3 mt-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted"
            >
              <Upload className="w-4 h-4" /> Upload
            </button>
            <button
              onClick={openCamera}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted"
            >
              <Camera className="w-4 h-4" /> Camera
            </button>
          </div>

          <button
            onClick={handleAnalyze}
            disabled={loading || !imageBase64}
            className="w-full mt-4 py-3 agri-gradient text-primary-foreground rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 shadow-md transition-all active:scale-95"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
            {loading ? "AI is Analyzing…" : "Start Auto AI Scan"}
          </button>
        </div>

        {/* Results */}
        <div className="lg:col-span-3 bg-card rounded-xl border border-border overflow-hidden flex flex-col min-h-[500px]">
          <div className="bg-muted/30 px-6 py-4 border-b border-border flex justify-between items-center">
            <h2 className="font-semibold text-sm">2. AI Diagnostic Report</h2>
            {result && (
              <Badge className={`uppercase text-[10px] px-2 ${severityColor(result.severity)} border-none`}>
                {result.severity} Severity
              </Badge>
            )}
          </div>

          <div className="p-6 flex-1 bg-white">
            {loading && (
              <div className="flex flex-col items-center justify-center text-center py-20 h-full">
                <div className="relative mb-6">
                  <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                  <ScanLine className="w-6 h-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                </div>
                <p className="font-bold text-lg text-foreground">Analyzing Image...</p>
                <p className="text-sm text-muted-foreground animate-pulse">Running AI Pathology Diagnostic</p>
              </div>
            )}

            {!loading && !result && (
              <div className="flex flex-col items-center justify-center text-center py-20 h-full text-muted-foreground">
                <ShieldAlert className="w-12 h-12 mb-4 opacity-20" />
                <p className="font-medium">Ready for Diagnostic</p>
                <p className="text-sm mt-1 max-w-[200px] mx-auto">Upload a clear photo of the leaf or affected area for processing.</p>
              </div>
            )}

            {!loading && result && (
              <div className="space-y-6 animate-in fade-in duration-500">
                {/* Identification Header */}
                <div className="p-4 bg-muted/30 rounded-xl border border-border/50">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <ShieldAlert className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground">Pathology Result</p>
                      <p className="font-bold text-foreground text-xl">{result.disease}</p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground">AI Confidence</p>
                      <p className="font-bold text-agri-green text-lg">{result.confidence}%</p>
                    </div>
                  </div>
                </div>

                {/* Symptoms & Treatment */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-bold border-l-4 border-agri-amber pl-2 mb-3">Symptoms</h3>
                    <ul className="text-sm space-y-2">
                      {result.symptoms?.map((s, i) => (
                        <li key={i} className="flex gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-agri-amber shrink-0 mt-1.5" />
                          <span className="text-muted-foreground">{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-bold border-l-4 border-agri-green pl-2 mb-2">Recommended Treatment</h3>
                      <p className="text-sm text-foreground bg-agri-green/5 p-3 rounded-lg border border-agri-green/10">
                        {result.treatment}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold border-l-4 border-primary pl-2 mb-2">Prevention Plan</h3>
                      <p className="text-sm text-muted-foreground">
                        {result.prevention}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-agri-amber/5 p-4 rounded-xl border border-agri-amber/20">
                  <p className="text-[10px] text-agri-amber font-bold flex items-center gap-2">
                    <AlertTriangle className="w-3 h-3" /> DISCLAIMER:
                    <span className="font-normal uppercase">AI results are advisory only. Consult local experts before large-scale chemical application.</span>
                  </p>
                </div>
              </div>
            )}
          </div>

          <canvas ref={canvasRef} className="hidden" />

          {/* Camera Capture Modal */}
          <Dialog open={isCameraOpen} onOpenChange={setIsCameraOpen}>
            <DialogContent className="w-[95vw] sm:max-w-xl p-0 overflow-hidden bg-black border-none rounded-xl">
              <div className="relative aspect-video bg-black flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  onLoadedMetadata={() => videoRef.current?.play()}
                />
                <div className="absolute inset-0 border-2 border-white/20 pointer-events-none flex items-center justify-center">
                  <div className="w-64 h-64 border-2 border-dashed border-white/50 rounded-lg" />
                </div>
                <div className="absolute top-4 left-4">
                  <Badge className="bg-primary/80 border-none">Live Camera Feed</Badge>
                </div>
              </div>
              <div className="p-6 bg-card flex justify-center gap-4">
                <Button variant="outline" onClick={closeCamera}>Cancel</Button>
                <Button onClick={captureImage} className="gap-2 px-8">
                  <Camera className="w-4 h-4" /> Capture Photo
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
};

// Helper for UI badges
const Badge = ({ children, className, variant }: any) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-medium ${className} ${variant === 'outline' ? 'border border-border' : ''}`}>
    {children}
  </span>
);

export default CropScanner;
