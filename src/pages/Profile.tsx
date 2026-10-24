import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Camera, Edit2, Save, X, Activity, Key, LogOut, CheckCircle2,
  MapPin, Wheat, Droplets, Navigation, RefreshCw, AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { broadcastClientSync } from "@/hooks/useRealtimeSync";

const cropOptions = [
  "Rice", "Wheat", "Maize", "Sugarcane", "Cotton",
  "Soybean", "Groundnut", "Mustard", "Potato", "Tomato",
  "Onion", "Chilli", "Turmeric", "Banana", "Mango",
];

const UnifiedProfile = () => {
  const { user, role, signOut, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [activeTab, setActiveTab] = useState<"personal" | "farming" | "account">("personal");

  const [formData, setFormData] = useState<any>({});
  const [initialData, setInitialData] = useState<any>({});
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const data = await api.get<any>("/profile");
      if (data) {
        const normalized = {
          ...data,
          full_name: data.fullName || data.full_name || "",
          phone: data.phone || data.phone_number || "",
          email: data.email || user?.email || "",
          region: data.region || "",
          address: data.address || data.deliveryAddress || "",
          deliveryAddress: data.deliveryAddress || data.address || "",
          avatar_url: data.avatarUrl || data.avatar_url || "",
          latitude: data.latitude !== null && data.latitude !== undefined ? data.latitude : null,
          longitude: data.longitude !== null && data.longitude !== undefined ? data.longitude : null,

          // Farmer fields
          primaryCrop: data.primaryCrop || data.primary_crops || "",
          secondaryCrop: data.secondaryCrop || data.secondary_crop || "",
          landArea: data.landArea ?? data.totalLandArea ?? data.total_land_area ?? "",
          totalYield: data.totalYield ?? data.total_yield ?? "",
          monthlyProduction: data.monthlyProduction ?? data.monthly_production ?? "",
          expectedPrice: data.expectedPrice ?? data.expected_price ?? "",
          waterAvailability: data.waterAvailability || data.water_availability || "Medium",
          farmingType: data.farmingType || data.farming_type || "Mixed",
          harvestCycle: data.harvestCycle || data.harvest_cycle || "Seasonal",

          // Additional agricultural metadata
          farmName: data.farmName || data.farm_name || "",
          irrigationType: data.irrigationType || data.irrigation_type || "",
          soilType: data.soilType || data.soil_type || "",
          yearsOfExperience: data.yearsOfExperience ?? data.years_of_experience ?? "",

          // Consumer fields
          businessName: data.businessName || data.business_name || "",
          businessType: data.businessType || data.business_type || "Retailer",
          preferredCrops: data.preferredCrops || data.preferred_crops || "",
          purchaseVolumeCapacity: data.purchaseVolumeCapacity ?? data.purchase_volume_capacity ?? "",
        };

        setInitialData(normalized);
        setFormData(normalized);
        setPhotoUrl(normalized.avatar_url || "");
      }
    } catch (err: any) {
      console.warn("MongoDB profile fetch note, checking Supabase profile fallback:", err);
      try {
        const { data } = await supabase.from("profiles").select("*").eq("id", user?.id).single();
        if (data) {
          const normalized = {
            ...data,
            full_name: data.full_name || "",
            phone: data.phone || "",
            email: user?.email || "",
            region: data.region || "",
            avatar_url: data.avatar_url || "",
          };
          setInitialData(normalized);
          setFormData(normalized);
          setPhotoUrl(normalized.avatar_url || "");
        }
      } catch (supaErr) {
        console.error("Profile load error:", supaErr);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const validate = () => {
    if (!formData.full_name?.trim()) {
      toast.error("Full Name cannot be empty");
      return false;
    }
    if (formData.phone && !/^\+?[0-9\s-]{8,15}$/.test(formData.phone)) {
      toast.error("Please enter a valid phone number (minimum 8-10 digits)");
      return false;
    }
    if (!formData.region?.trim()) {
      toast.error("Region / District is required");
      return false;
    }

    if (role === "farmer") {
      if (formData.landArea && isNaN(Number(formData.landArea))) {
        toast.error("Total Land Area must be a numeric value");
        return false;
      }
      if (formData.totalYield && isNaN(Number(formData.totalYield))) {
        toast.error("Total Yield must be a numeric value");
        return false;
      }
      if (formData.monthlyProduction && isNaN(Number(formData.monthlyProduction))) {
        toast.error("Monthly Production must be a numeric value");
        return false;
      }
      if (formData.expectedPrice && isNaN(Number(formData.expectedPrice))) {
        toast.error("Expected Price must be a numeric value");
        return false;
      }
    }

    if (role === "consumer") {
      if (formData.purchaseVolumeCapacity && isNaN(Number(formData.purchaseVolumeCapacity))) {
        toast.error("Purchase Volume Capacity must be a numeric value");
        return false;
      }
    }

    return true;
  };

  const detectLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    toast.info("Requesting precise GPS coordinates...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lng = parseFloat(pos.coords.longitude.toFixed(6));
        handleInputChange("latitude", lat);
        handleInputChange("longitude", lng);
        toast.success(`📍 GPS updated: ${lat}, ${lng}`);
      },
      (err) => {
        toast.error("Unable to retrieve location: " + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);

    try {
      const apiUpdates: any = {
        fullName: formData.full_name?.trim(),
        phone: formData.phone?.trim(),
        region: formData.region?.trim(),
        address: formData.address?.trim() || "",
        avatarUrl: photoUrl || formData.avatar_url || "",
        latitude: formData.latitude !== null && formData.latitude !== "" ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude !== null && formData.longitude !== "" ? parseFloat(formData.longitude) : null,
      };

      if (role === "farmer") {
        apiUpdates.primaryCrop = formData.primaryCrop || "";
        apiUpdates.secondaryCrop = formData.secondaryCrop === "none" ? "" : (formData.secondaryCrop || "");
        apiUpdates.landArea = formData.landArea ? parseFloat(formData.landArea) : 0;
        apiUpdates.totalYield = formData.totalYield ? parseFloat(formData.totalYield) : 0;
        apiUpdates.monthlyProduction = formData.monthlyProduction ? parseFloat(formData.monthlyProduction) : 0;
        apiUpdates.expectedPrice = formData.expectedPrice ? parseFloat(formData.expectedPrice) : 0;
        apiUpdates.waterAvailability = formData.waterAvailability || "Medium";
        apiUpdates.farmingType = formData.farmingType || "Mixed";
        apiUpdates.harvestCycle = formData.harvestCycle || "Seasonal";
        apiUpdates.farmName = formData.farmName?.trim() || "";
        apiUpdates.irrigationType = formData.irrigationType || "";
        apiUpdates.soilType = formData.soilType || "";
        apiUpdates.yearsOfExperience = formData.yearsOfExperience ? parseFloat(formData.yearsOfExperience) : null;
      } else {
        apiUpdates.deliveryAddress = formData.deliveryAddress?.trim() || formData.address?.trim() || "";
        apiUpdates.businessName = formData.businessName?.trim() || "";
        apiUpdates.businessType = formData.businessType || "Retailer";
        apiUpdates.preferredCrops = formData.preferredCrops?.trim() || "";
        apiUpdates.purchaseVolumeCapacity = formData.purchaseVolumeCapacity ? parseFloat(formData.purchaseVolumeCapacity) : null;
      }

      const res = await api.put("/profile", apiUpdates);
      toast.success("Profile updated successfully!");

      // Broadcast update across connected frontend components
      broadcastClientSync({
        type: "SYNC_EVENT",
        entity: "farmer_profile",
        action: "update",
        id: user?.id,
        data: {
          id: user?.id,
          full_name: apiUpdates.fullName,
          phone: apiUpdates.phone,
          region: apiUpdates.region,
          primary_crop: apiUpdates.primaryCrop,
          secondary_crop: apiUpdates.secondaryCrop,
          land_area: apiUpdates.landArea,
          total_yield: apiUpdates.totalYield,
          monthly_production: apiUpdates.monthlyProduction,
          expected_price: apiUpdates.expectedPrice,
          water_availability: apiUpdates.waterAvailability,
          farming_type: apiUpdates.farmingType,
          harvest_cycle: apiUpdates.harvestCycle,
          latitude: apiUpdates.latitude,
          longitude: apiUpdates.longitude,
          avatar_url: apiUpdates.avatarUrl,
        },
      });

      setInitialData({ ...formData, ...apiUpdates });
      setEditMode(false);
      if (refreshUser) refreshUser();
    } catch (err: any) {
      toast.error("Failed to update profile: " + (err.message || "Server error"));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({ ...initialData });
    setPhotoUrl(initialData.avatar_url || "");
    setEditMode(false);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const fileExt = file.name.split(".").pop();
    const filePath = `avatars/${user?.id || "user"}-${Date.now()}.${fileExt}`;

    setUploading(true);
    try {
      const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file, {
        upsert: true,
      });

      if (uploadError) {
        // Fallback: convert to base64 Data URL for instant profile picture support
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Url = reader.result as string;
          setPhotoUrl(base64Url);
          setFormData((prev: any) => ({ ...prev, avatar_url: base64Url }));
          toast.success("Photo uploaded successfully");
        };
        reader.readAsDataURL(file);
      } else {
        const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(filePath);
        setPhotoUrl(publicUrl);
        setFormData((prev: any) => ({ ...prev, avatar_url: publicUrl }));
        toast.success("Profile photo uploaded successfully");
      }
    } catch (err: any) {
      toast.error("Upload error: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const calculateCompletion = () => {
    const requiredCommon = ["full_name", "phone", "region"];
    let filled = 0;

    const requiredFields = role === "farmer"
      ? [...requiredCommon, "primaryCrop", "landArea", "totalYield", "monthlyProduction", "expectedPrice"]
      : [...requiredCommon, "address", "preferredCrops"];

    requiredFields.forEach((f) => {
      if (formData[f] !== undefined && formData[f] !== null && formData[f] !== "") filled++;
    });

    return Math.round((filled / requiredFields.length) * 100);
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-muted-foreground animate-pulse">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-primary" />
        <p className="text-base font-medium">Loading profile information...</p>
      </div>
    );
  }

  const completionPct = calculateCompletion();

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Profile Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage your account credentials, agricultural registrations, and real-time marketplace details
          </p>
        </div>
        {!editMode ? (
          <Button onClick={() => setEditMode(true)} className="gap-2 shrink-0">
            <Edit2 className="w-4 h-4" /> Edit Profile
          </Button>
        ) : (
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" onClick={handleCancel} disabled={saving}>
              <X className="w-4 h-4 mr-2" /> Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 mr-2" /> {saving ? "Saving Changes..." : "Save Changes"}
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Left Column: Avatar & Summary */}
        <div className="md:col-span-1 space-y-6">
          <Card className="text-center overflow-hidden border-border/60">
            <div className="h-24 bg-gradient-to-r from-primary to-primary/80 w-full" />
            <CardContent className="pt-0 relative px-6 pb-6">
              <div className="relative w-24 h-24 mx-auto -mt-12 mb-4 rounded-full border-4 border-card bg-muted flex items-center justify-center overflow-hidden shadow">
                {photoUrl ? (
                  <img src={photoUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl font-bold text-muted-foreground">
                    {(formData.full_name || "U").charAt(0).toUpperCase()}
                  </span>
                )}
                {editMode && (
                  <label className="absolute inset-0 bg-black/50 cursor-pointer flex items-center justify-center transition-opacity opacity-0 hover:opacity-100">
                    <Camera className="w-6 h-6 text-white" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoUpload}
                      disabled={uploading}
                    />
                  </label>
                )}
              </div>

              <h2 className="text-xl font-bold truncate text-foreground">{formData.full_name || "User"}</h2>
              <Badge variant="secondary" className="mt-1 capitalize">
                {role === "farmer" ? "🌾 Registered Farmer" : "🛒 Verified Consumer"}
              </Badge>

              <div className="mt-4 space-y-2.5 text-sm text-left px-1 border-t border-border/50 pt-3">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="font-medium text-foreground text-xs">Region:</span>
                  <span className="truncate max-w-[140px] font-semibold text-xs text-foreground">
                    {formData.region || "Not specified"}
                  </span>
                </div>
                {role === "farmer" && (
                  <>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="font-medium text-foreground text-xs">Primary Crop:</span>
                      <span className="truncate max-w-[140px] font-semibold text-xs text-foreground">
                        {formData.primaryCrop || "None"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="font-medium text-foreground text-xs">Land Area:</span>
                      <span className="font-semibold text-xs text-foreground">
                        {formData.landArea ? `${formData.landArea} Acres` : "0 Acres"}
                      </span>
                    </div>
                  </>
                )}
                {role === "consumer" && (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="font-medium text-foreground text-xs">Type:</span>
                    <span className="font-semibold text-xs text-foreground">
                      {formData.businessType || "Retailer"}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-border/50 text-left">
                <p className="text-xs font-bold uppercase text-muted-foreground mb-1.5 flex justify-between">
                  Profile Completion <span>{completionPct}%</span>
                </p>
                <Progress value={completionPct} className="h-2" />
              </div>
            </CardContent>
          </Card>

          {/* Navigation Tabs */}
          <Card className="border-border/60">
            <div className="flex flex-col p-2 space-y-1">
              <button
                className={`flex items-center gap-3 w-full text-left px-4 py-3 rounded-md text-sm font-medium transition-colors ${
                  activeTab === "personal"
                    ? "bg-primary/10 text-primary font-semibold"
                    : "hover:bg-muted/50 text-muted-foreground"
                }`}
                onClick={() => setActiveTab("personal")}
              >
                <Activity className="w-4 h-4" /> Personal Details
              </button>
              {role === "farmer" && (
                <button
                  className={`flex items-center gap-3 w-full text-left px-4 py-3 rounded-md text-sm font-medium transition-colors ${
                    activeTab === "farming"
                      ? "bg-primary/10 text-primary font-semibold"
                      : "hover:bg-muted/50 text-muted-foreground"
                  }`}
                  onClick={() => setActiveTab("farming")}
                >
                  <Wheat className="w-4 h-4" /> Farming & Crops
                </button>
              )}
              <button
                className={`flex items-center gap-3 w-full text-left px-4 py-3 rounded-md text-sm font-medium transition-colors ${
                  activeTab === "account"
                    ? "bg-primary/10 text-primary font-semibold"
                    : "hover:bg-muted/50 text-muted-foreground"
                }`}
                onClick={() => setActiveTab("account")}
              >
                <Key className="w-4 h-4" /> Account & Security
              </button>
            </div>
          </Card>
        </div>

        {/* Right Column: Editable Form Fields */}
        <div className="md:col-span-3 space-y-6">
          <Card className="border-border/60">
            <CardHeader className="bg-muted/20 border-b">
              <CardTitle className="text-lg">
                {activeTab === "personal"
                  ? "Contact & Location Information"
                  : activeTab === "farming"
                  ? "Cultivation, Harvest & Production Details"
                  : "Account & Login Security"}
              </CardTitle>
              <CardDescription>
                {editMode
                  ? "Modify fields and click Save Changes to sync across the system."
                  : "Click 'Edit Profile' to update your details."}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">

              {/* 1. PERSONAL TAB */}
              {activeTab === "personal" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="full_name">Full Name *</Label>
                      <Input
                        id="full_name"
                        value={formData.full_name || ""}
                        onChange={(e) => handleInputChange("full_name", e.target.value)}
                        disabled={!editMode}
                        placeholder="Your full name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number *</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone || ""}
                        onChange={(e) => handleInputChange("phone", e.target.value)}
                        disabled={!editMode}
                        placeholder="+91 9876543210"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="region">Region / District *</Label>
                      <Input
                        id="region"
                        value={formData.region || ""}
                        onChange={(e) => handleInputChange("region", e.target.value)}
                        disabled={!editMode}
                        placeholder="e.g. Nashik, Maharashtra or Guntur"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address">Address / Village / Town</Label>
                      <Input
                        id="address"
                        value={formData.address || ""}
                        onChange={(e) => handleInputChange("address", e.target.value)}
                        disabled={!editMode}
                        placeholder="Street, Landmark, Village"
                      />
                    </div>
                  </div>

                  {/* GPS Coordinates Section */}
                  <div className="p-4 border rounded-lg bg-muted/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-primary" />
                        <span className="font-semibold text-sm">Farm / Delivery GPS Coordinates</span>
                      </div>
                      {editMode && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={detectLocation}
                          className="h-8 gap-1.5 text-xs"
                        >
                          <Navigation className="w-3.5 h-3.5 text-primary" /> Auto-Detect GPS
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Latitude</Label>
                        <Input
                          type="number"
                          step="0.0001"
                          value={formData.latitude !== null && formData.latitude !== undefined ? formData.latitude : ""}
                          onChange={(e) => handleInputChange("latitude", e.target.value)}
                          disabled={!editMode}
                          placeholder="e.g. 17.3850"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Longitude</Label>
                        <Input
                          type="number"
                          step="0.0001"
                          value={formData.longitude !== null && formData.longitude !== undefined ? formData.longitude : ""}
                          onChange={(e) => handleInputChange("longitude", e.target.value)}
                          disabled={!editMode}
                          placeholder="e.g. 78.4867"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Consumer Business Details (if consumer role) */}
                  {role === "consumer" && (
                    <div className="border-t pt-4 space-y-4">
                      <h3 className="font-semibold text-sm text-foreground">Consumer Preferences</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Business / Establishment Name</Label>
                          <Input
                            value={formData.businessName || ""}
                            onChange={(e) => handleInputChange("businessName", e.target.value)}
                            disabled={!editMode}
                            placeholder="e.g. Fresh Mart Retailers"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Business Type</Label>
                          <Select
                            disabled={!editMode}
                            value={formData.businessType || "Retailer"}
                            onValueChange={(val) => handleInputChange("businessType", val)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Individual">Individual Consumer</SelectItem>
                              <SelectItem value="Retailer">Retailer</SelectItem>
                              <SelectItem value="Wholesaler">Wholesaler</SelectItem>
                              <SelectItem value="Restaurant">Restaurant / Hotel</SelectItem>
                              <SelectItem value="Processor">Food Processor</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Preferred Crops / Produce</Label>
                          <Input
                            value={formData.preferredCrops || ""}
                            onChange={(e) => handleInputChange("preferredCrops", e.target.value)}
                            disabled={!editMode}
                            placeholder="e.g. Rice, Tomato, Onion"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Monthly Purchase Volume (kg/tons)</Label>
                          <Input
                            type="number"
                            value={formData.purchaseVolumeCapacity || ""}
                            onChange={(e) => handleInputChange("purchaseVolumeCapacity", e.target.value)}
                            disabled={!editMode}
                            placeholder="e.g. 500"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 2. FARMING TAB (Farmers Only) */}
              {activeTab === "farming" && role === "farmer" && (
                <div className="space-y-6">
                  {/* Primary & Secondary Crops */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Primary Crop *</Label>
                      <Select
                        disabled={!editMode}
                        value={formData.primaryCrop || ""}
                        onValueChange={(val) => handleInputChange("primaryCrop", val)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select primary crop" />
                        </SelectTrigger>
                        <SelectContent>
                          {cropOptions.map((crop) => (
                            <SelectItem key={crop} value={crop}>{crop}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Secondary Crop (Optional)</Label>
                      <Select
                        disabled={!editMode}
                        value={formData.secondaryCrop || "none"}
                        onValueChange={(val) => handleInputChange("secondaryCrop", val)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select secondary crop" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {cropOptions.map((crop) => (
                            <SelectItem key={crop} value={crop}>{crop}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Land Area, Yield, Monthly Production, Price */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label>Land Area (Acres) *</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={formData.landArea || ""}
                        onChange={(e) => handleInputChange("landArea", e.target.value)}
                        disabled={!editMode}
                        placeholder="e.g. 5"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Total Yield (kg) *</Label>
                      <Input
                        type="number"
                        step="1"
                        value={formData.totalYield || ""}
                        onChange={(e) => handleInputChange("totalYield", e.target.value)}
                        disabled={!editMode}
                        placeholder="e.g. 2500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Monthly Yield (kg) *</Label>
                      <Input
                        type="number"
                        step="1"
                        value={formData.monthlyProduction || ""}
                        onChange={(e) => handleInputChange("monthlyProduction", e.target.value)}
                        disabled={!editMode}
                        placeholder="e.g. 500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Price (₹/kg) *</Label>
                      <Input
                        type="number"
                        step="0.5"
                        value={formData.expectedPrice || ""}
                        onChange={(e) => handleInputChange("expectedPrice", e.target.value)}
                        disabled={!editMode}
                        placeholder="e.g. 45"
                      />
                    </div>
                  </div>

                  {/* Agricultural Practices */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4">
                    <div className="space-y-2">
                      <Label>Water Availability</Label>
                      <Select
                        disabled={!editMode}
                        value={formData.waterAvailability || "Medium"}
                        onValueChange={(val) => handleInputChange("waterAvailability", val)}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Low">Low</SelectItem>
                          <SelectItem value="Medium">Medium</SelectItem>
                          <SelectItem value="High">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Farming Method</Label>
                      <Select
                        disabled={!editMode}
                        value={formData.farmingType || "Mixed"}
                        onValueChange={(val) => handleInputChange("farmingType", val)}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Organic">Organic</SelectItem>
                          <SelectItem value="Mixed">Mixed</SelectItem>
                          <SelectItem value="Chemical">Conventional / Chemical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Harvest Cycle</Label>
                      <Select
                        disabled={!editMode}
                        value={formData.harvestCycle || "Seasonal"}
                        onValueChange={(val) => handleInputChange("harvestCycle", val)}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Monthly">Monthly</SelectItem>
                          <SelectItem value="Seasonal">Seasonal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Optional Farm Brand Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
                    <div className="space-y-2">
                      <Label>Farm Brand / Estate Name</Label>
                      <Input
                        value={formData.farmName || ""}
                        onChange={(e) => handleInputChange("farmName", e.target.value)}
                        disabled={!editMode}
                        placeholder="e.g. Green Valley Farm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Irrigation Infrastructure</Label>
                      <Select
                        disabled={!editMode}
                        value={formData.irrigationType || "Rainfed"}
                        onValueChange={(val) => handleInputChange("irrigationType", val)}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Drip">Drip Irrigation</SelectItem>
                          <SelectItem value="Sprinkler">Sprinkler System</SelectItem>
                          <SelectItem value="Rainfed">Rainfed</SelectItem>
                          <SelectItem value="Canal">Canal / River</SelectItem>
                          <SelectItem value="Borewell">Borewell</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. ACCOUNT & SECURITY TAB */}
              {activeTab === "account" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Registered Email Address</Label>
                      <Input value={formData.email || user?.email || ""} disabled className="bg-muted" />
                      <p className="text-[11px] text-muted-foreground">
                        Your email address is your verified sign-in identity.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Account Role</Label>
                      <Input value={role || ""} disabled className="bg-muted capitalize" />
                      <p className="text-[11px] text-muted-foreground">
                        Permissions are bound to this authenticated account role.
                      </p>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg bg-amber-500/10 border-amber-500/20 text-amber-900 dark:text-amber-200 space-y-2">
                    <div className="flex items-center gap-2 font-semibold text-sm">
                      <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span>Security & Password Protection</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      To change your password, you can use the secure single-use Password Reset procedure sent directly to your registered email address.
                    </p>
                  </div>
                </div>
              )}

            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default UnifiedProfile;
