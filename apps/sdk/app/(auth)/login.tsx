import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import Loader from "../../components/Loader";
import { exchangeSupabaseTokenForJwt, loginWithSupabase } from "../../lib/auth";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    setLoading(true);

    try {
      const session = await loginWithSupabase(email.trim().toLowerCase(), password);
      await exchangeSupabaseTokenForJwt(session.access_token);
      router.replace("/(inventory)/index");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Loader label="Signing in" />;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: "padding", android: undefined })}
      style={{ flex: 1, backgroundColor: "#020617", padding: 24 }}
    >
      <View style={{ flex: 1, justifyContent: "center", gap: 16 }}>
        <View>
          <Text style={{ fontSize: 28, fontWeight: "700", color: "#f8fafc" }}>Store Login</Text>
          <Text style={{ color: "#cbd5f5", marginTop: 4 }}>
            Sign in with your Supabase staff account to manage inventory.
          </Text>
        </View>

        <View style={{ gap: 12 }}>
          <View>
            <Text style={{ color: "#94a3b8", marginBottom: 4 }}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="staff@store.com"
              placeholderTextColor="#64748b"
              style={inputStyle}
            />
          </View>
          <View>
            <Text style={{ color: "#94a3b8", marginBottom: 4 }}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#64748b"
              secureTextEntry
              style={inputStyle}
            />
          </View>
        </View>

        {error ? <Text style={{ color: "#f87171" }}>{error}</Text> : null}

        <TouchableOpacity
          onPress={handleLogin}
          style={{
            backgroundColor: "#38bdf8",
            padding: 16,
            borderRadius: 12,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#0f172a", fontWeight: "700" }}>Sign In</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const inputStyle = {
  backgroundColor: "#0f172a",
  borderRadius: 10,
  padding: 14,
  color: "#e2e8f0",
  borderWidth: 1,
  borderColor: "rgba(148,163,184,0.2)",
};
