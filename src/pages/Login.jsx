import { useState, useEffect } from "react";
import * as Yup from "yup";
import { Formik, Form, Field, ErrorMessage } from "formik";
import { useNavigate , Link} from "react-router-dom";
import useAuth from "../hooks/useAuth";

// High-resolution dedicated background images for Intern Management System
import bg1 from "../assets/images/intern_bg_1.jpg";
import bg2 from "../assets/images/intern_bg_2.jpg";
import bg3 from "../assets/images/intern_bg_3.jpg";

const BACKGROUND_IMAGES = [bg1, bg2, bg3];

const validationSchema = Yup.object({
    email: Yup.string()
        .email("Enter a valid email address!")
        .required("Email is required!"),
    password: Yup.string()
        .required("Password is required!"),
});

const Login = () => {
    const navigate = useNavigate();
    const { login, isAuthenticated, user } = useAuth();
    const [showPassword, setShowPassword] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [serverError, setServerError] = useState("");

    // If already authenticated, navigate to dashboard or changePassword
    useEffect(() => {
        if (isAuthenticated) {
            if (user?.firstLogin) {
                navigate("/changePassword");
            } else {
                navigate("/dashboard");
            }
        }
    }, [isAuthenticated, user, navigate]);

    // Automatically cycle through background images with smooth transitions
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentImageIndex((prev) => (prev + 1) % BACKGROUND_IMAGES.length);
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleLogin = async (values, { setSubmitting }) => {
        setServerError("");
        const res = await login(values.email, values.password);
        setSubmitting(false);
        if (res.success) {
            if (res.user?.firstLogin || res.redirectTo === '/changePassword' || res.redirectTo === '/change-password') {
                navigate("/changePassword");
            } else {
                navigate("/dashboard");
            }
        } else {
            setServerError(res.error || "Failed to sign in. Please check your credentials.");
        }
    };

    return (
        <div className="relative min-h-screen min-h-[100dvh] w-full flex items-center justify-center p-4 sm:p-6 overflow-x-hidden overflow-y-auto">
            {/* High-Resolution Sliding Background Images with Smooth Cross-fade */}
            <div className="fixed inset-0 w-full h-full -z-10 overflow-hidden">
                {BACKGROUND_IMAGES.map((img, index) => (
                    <img
                        key={index}
                        src={img}
                        alt="Intern Management System Workspace"
                        className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-1000 ease-in-out ${index === currentImageIndex
                            ? "opacity-100"
                            : "opacity-0 pointer-events-none"
                            }`}
                    />
                ))}

                {/* Ambient dark gradient overlay to ensure contrast and readability */}
                <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[1px]" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/60" />
            </div>

            {/* Transparent Glassmorphic Login Card */}
            <div className="relative w-full max-w-md bg-slate-900/40 backdrop-blur-xl rounded-2xl shadow-2xl shadow-black/60 border border-white/20 p-6 sm:p-10 z-10 transition-all">
                {/* Top edge subtle highlight glow */}
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent rounded-t-2xl pointer-events-none" />

                {/* Card Header & Brand Logo */}
                <div className="mb-7">
                    <div className="w-12 h-12 rounded-xl bg-blue-600/90 text-white flex items-center justify-center shadow-lg shadow-blue-500/30 mb-4 border border-white/20">
                        <svg
                            className="w-6 h-6 text-white"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-extrabold text-white tracking-tight">
                        Welcome back
                    </h1>
                    <p className="text-sm text-slate-200/90 mt-1">
                        Sign in to access your TMS management dashboard.
                    </p>
                </div>

                {/* Server Error Alert */}
                {serverError && (
                    <div className="mb-6 p-3.5 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-200 text-xs flex items-center gap-2.5 backdrop-blur-sm animate-shake">
                        <svg className="w-5 h-5 text-rose-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{serverError}</span>
                    </div>
                )}

                {/* Formik Form */}
                <Formik
                    initialValues={{
                        email: "",
                        password: "",
                        rememberMe: false,
                    }}
                    validationSchema={validationSchema}
                    onSubmit={handleLogin}
                >
                    {({ isSubmitting }) => (
                        <Form className="space-y-5">
                            {/* Email Field */}
                            <div>
                                <label
                                    htmlFor="email"
                                    className="block text-xs font-semibold text-slate-200 uppercase tracking-wider mb-1.5"
                                >
                                    Email Address
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-300">
                                        <svg
                                            className="w-4 h-4"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth="2"
                                                d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
                                            />
                                        </svg>
                                    </div>
                                    <Field
                                        id="email"
                                        type="email"
                                        name="email"
                                        placeholder="Enter your email..."
                                        className="w-full pl-10 pr-4 py-2.5 bg-white/10 hover:bg-white/[0.14] focus:bg-white/[0.18] border border-white/20 focus:border-blue-400 rounded-lg text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400/30 backdrop-blur-sm transition-all"
                                    />
                                </div>
                                <ErrorMessage
                                    name="email"
                                    component="div"
                                    className="text-xs text-rose-300 font-medium mt-1 flex items-center gap-1"
                                />
                            </div>

                            {/* Password Field */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label
                                        htmlFor="password"
                                        className="block text-xs font-semibold text-slate-200 uppercase tracking-wider"
                                    >
                                        Password
                                    </label>
                                    <Link
                                        to="/forgot-password"
                                         className="text-xs font-medium text-blue-300 hover:text-blue-200 hover:underline transition-colors"
                                        >
                                         Forgot password?
                                    </Link>
                                </div>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-300">
                                        <svg
                                            className="w-4 h-4"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth="2"
                                                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                            />
                                        </svg>
                                    </div>
                                    <Field
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        name="password"
                                        placeholder="Enter your password..."
                                        className="w-full pl-10 pr-10 py-2.5 bg-white/10 hover:bg-white/[0.14] focus:bg-white/[0.18] border border-white/20 focus:border-blue-400 rounded-lg text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400/30 backdrop-blur-sm transition-all"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        aria-label={showPassword ? "Hide password" : "Show password"}
                                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-300 hover:text-white cursor-pointer transition-colors"
                                    >
                                        {showPassword ? (
                                            <svg
                                                className="w-4 h-4"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth="2"
                                                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
                                                />
                                            </svg>
                                        ) : (
                                            <svg
                                                className="w-4 h-4"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth="2"
                                                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                                />
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth="2"
                                                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                                />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                                <ErrorMessage
                                    name="password"
                                    component="div"
                                    className="text-xs text-rose-300 font-medium mt-1 flex items-center gap-1"
                                />
                            </div>


                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:from-blue-700 active:to-indigo-700 disabled:opacity-50 text-white font-semibold text-sm rounded-lg shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50 transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                                {isSubmitting ? (
                                    <>
                                        <svg
                                            className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                        >
                                            <circle
                                                className="opacity-25"
                                                cx="12"
                                                cy="12"
                                                r="10"
                                                stroke="currentColor"
                                                strokeWidth="4"
                                            />
                                            <path
                                                className="opacity-75"
                                                fill="currentColor"
                                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                            />
                                        </svg>
                                        <span>Logging in...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Sign In</span>
                                        <svg
                                            className="w-4 h-4"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth="2"
                                                d="M14 5l7 7m0 0l-7 7m7-7H3"
                                            />
                                        </svg>
                                    </>
                                )}
                            </button>
                        </Form>
                    )}
                </Formik>

                {/* Footer info */}
                <div className="mt-7 pt-5 border-t border-white/15 text-center">
                    <p className="text-xs text-slate-300/80">
                        Training Management System &copy; 2026. All rights reserved.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
