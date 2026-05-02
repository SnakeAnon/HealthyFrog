import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { updateMe } from "../api/users";
import { useAuth } from "../context/AuthContext";

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    age: "",
    height: "",
    weight: "",
    goal: "",
    bio: "",
    specialty: "",
  });

  useEffect(() => {
    if (user) {
      setForm({
        name:      user.name ?? "",
        age:       user.age?.toString() ?? "",
        height:    user.height?.toString() ?? "",
        weight:    user.weight?.toString() ?? "",
        goal:      user.goal ?? "",
        bio:       user.bio ?? "",
        specialty: user.specialty ?? "",
      });
    }
  }, [user]);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      await updateMe({
        name:      form.name || undefined,
        age:       form.age ? Number(form.age) : undefined,
        height:    form.height ? Number(form.height) : undefined,
        weight:    form.weight ? Number(form.weight) : undefined,
        goal:      form.goal || undefined,
        bio:       form.bio || undefined,
        specialty: form.specialty || undefined,
      });
      await refreshUser();
      setEditing(false);
      setSuccess(true);
    } catch {
      setError("Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  if (!user)
    return (
      <Box display="flex" justifyContent="center" mt={6}>
        <CircularProgress />
      </Box>
    );

  const isTrainer = user.role === "trainer";

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6" fontWeight={700}>
          My Profile
        </Typography>
        <Chip
          label={isTrainer ? "Trainer" : "User"}
          color={isTrainer ? "secondary" : "primary"}
          size="small"
        />
      </Box>

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(false)}>
          Profile saved!
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Typography variant="caption" color="text.secondary">
            {user.email}
          </Typography>
          <Divider sx={{ my: 1.5 }} />

          {editing ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <TextField label="Full Name" value={form.name} onChange={set("name")} fullWidth />
              {!isTrainer && (
                <>
                  <Box display="flex" gap={1}>
                    <TextField
                      label="Age"
                      type="number"
                      value={form.age}
                      onChange={set("age")}
                      fullWidth
                      inputProps={{ min: 1, max: 120 }}
                    />
                    <TextField
                      label="Height (cm)"
                      type="number"
                      value={form.height}
                      onChange={set("height")}
                      fullWidth
                    />
                  </Box>
                  <TextField
                    label="Weight (kg)"
                    type="number"
                    value={form.weight}
                    onChange={set("weight")}
                    fullWidth
                  />
                  <TextField label="Goal" value={form.goal} onChange={set("goal")} fullWidth />
                </>
              )}
              {isTrainer && (
                <>
                  <TextField
                    label="Bio"
                    value={form.bio}
                    onChange={set("bio")}
                    fullWidth
                    multiline
                    rows={3}
                  />
                  <TextField
                    label="Specialty"
                    value={form.specialty}
                    onChange={set("specialty")}
                    fullWidth
                  />
                </>
              )}
              <Box display="flex" gap={1}>
                <Button
                  variant="contained"
                  onClick={handleSave}
                  disabled={saving}
                  sx={{ flex: 1 }}
                >
                  {saving ? "Saving…" : "Save"}
                </Button>
                <Button variant="outlined" onClick={() => setEditing(false)} sx={{ flex: 1 }}>
                  Cancel
                </Button>
              </Box>
            </Box>
          ) : (
            <Box>
              <ProfileRow label="Name"     value={user.name} />
              {!isTrainer && (
                <>
                  <ProfileRow label="Age"     value={user.age ? `${user.age} years` : null} />
                  <ProfileRow label="Height"  value={user.height ? `${user.height} cm` : null} />
                  <ProfileRow label="Weight"  value={user.weight ? `${user.weight} kg` : null} />
                  <ProfileRow label="Goal"    value={user.goal} />
                </>
              )}
              {isTrainer && (
                <>
                  <ProfileRow label="Bio"       value={user.bio} />
                  <ProfileRow label="Specialty" value={user.specialty} />
                </>
              )}
              <Button variant="outlined" fullWidth sx={{ mt: 2 }} onClick={() => setEditing(true)}>
                Edit Profile
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

function ProfileRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <Box display="flex" justifyContent="space-between" py={0.5}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={500}>
        {value ?? <span style={{ color: "#bbb" }}>—</span>}
      </Typography>
    </Box>
  );
}
