'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2, Sparkles, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { useRegister } from '@/hooks/use-auth'
import { authApi, getApiError } from '@/lib/api'
import { getSectorOptions } from '@/lib/utils'

const registerSchema = z
  .object({
    full_name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Please enter a valid email'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Must contain at least one number'),
    confirm_password: z.string(),
    organization_name: z
      .string()
      .min(2, 'Organization name must be at least 2 characters'),
    sector: z.string().min(1, 'Please select your sector'),
    terms: z.boolean().refine((v) => v === true, {
      message: 'You must accept the terms of service',
    }),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })

type RegisterFormData = z.infer<typeof registerSchema>

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: '8+ characters', pass: password.length >= 8 },
    { label: 'Uppercase letter', pass: /[A-Z]/.test(password) },
    { label: 'Number', pass: /[0-9]/.test(password) },
    { label: 'Special character', pass: /[^A-Za-z0-9]/.test(password) },
  ]
  const strength = checks.filter((c) => c.pass).length
  const colors = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-green-400']

  if (!password) return null

  return (
    <div className="space-y-2 mt-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < strength ? colors[strength - 1] : 'bg-border'
            }`}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1">
        {checks.map((check) => (
          <div
            key={check.label}
            className={`flex items-center gap-1 text-xs transition-colors ${
              check.pass ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
            }`}
          >
            <Check
              className={`w-3 h-3 ${check.pass ? 'opacity-100' : 'opacity-30'}`}
            />
            {check.label}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm]   = useState(false)
  const [fbLoading, setFbLoading]       = useState(false)

  // Ping the backend on mount so Render wakes from idle before form submit
  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:8000'
    fetch(`${base}/health`, { method: 'GET' }).catch(() => {/* ignore */})
  }, [])
  const registerMutation = useRegister()
  const sectorOptions = getSectorOptions()

  const handleFacebookSignUp = async () => {
    setFbLoading(true)
    try {
      const res = await authApi.facebookLoginUrl()
      window.location.href = res.data.auth_url
    } catch (err: any) {
      toast.error(getApiError(err, 'Facebook sign-up unavailable. Use the form below.'))
      setFbLoading(false)
    }
  }

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { terms: false },
  })

  const password = watch('password', '')
  const isPending = registerMutation.isPending || isSubmitting

  const onSubmit = (data: RegisterFormData) => {
    registerMutation.mutate({
      email: data.email,
      password: data.password,
      full_name: data.full_name,
      organization_name: data.organization_name,
      sector: data.sector,
    })
  }

  return (
    <div className="animate-fade-in">
      {/* Mobile logo */}
      <div className="flex items-center gap-2 mb-6 lg:hidden">
        <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-lg text-foreground">Brandora AI</span>
      </div>

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">Create your account</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Join 500+ NGOs & CSR teams using Brandora AI
        </p>
      </div>

      {/* Facebook Sign Up */}
      <button
        type="button"
        onClick={handleFacebookSignUp}
        disabled={fbLoading || isPending}
        className="w-full h-11 mb-5 border border-[#1877F2]/30 bg-[#1877F2]/5 hover:bg-[#1877F2]/10 disabled:opacity-60 disabled:cursor-not-allowed rounded-xl text-sm font-semibold text-[#1877F2] dark:text-blue-400 flex items-center justify-center gap-3 transition-colors"
      >
        {fbLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
        )}
        {fbLoading ? 'Redirecting to Facebook…' : 'Sign up with Facebook'}
      </button>

      {/* Divider */}
      <div className="relative mb-5">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Or register with email</span>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Full name */}
        <div className="space-y-1.5">
          <label htmlFor="full_name" className="text-sm font-medium text-foreground">
            Full name
          </label>
          <input
            id="full_name"
            type="text"
            autoComplete="name"
            {...register('full_name')}
            placeholder="Priya Sharma"
            className="w-full h-11 px-4 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
          />
          {errors.full_name && (
            <p className="text-xs text-destructive">{errors.full_name.message}</p>
          )}
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium text-foreground">
            Work email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            {...register('email')}
            placeholder="priya@ngo-org.in"
            className="w-full h-11 px-4 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
          />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>

        {/* Organization + Sector side by side */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="organization_name" className="text-sm font-medium text-foreground">
              Organization name
            </label>
            <input
              id="organization_name"
              type="text"
              {...register('organization_name')}
              placeholder="Your NGO / Company"
              className="w-full h-11 px-4 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
            />
            {errors.organization_name && (
              <p className="text-xs text-destructive">
                {errors.organization_name.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="sector" className="text-sm font-medium text-foreground">
              Sector
            </label>
            <select
              id="sector"
              {...register('sector')}
              className="w-full h-11 px-4 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
            >
              <option value="">Select sector</option>
              {sectorOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {errors.sector && (
              <p className="text-xs text-destructive">{errors.sector.message}</p>
            )}
          </div>
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium text-foreground">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              {...register('password')}
              placeholder="••••••••"
              className="w-full h-11 px-4 pr-11 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <PasswordStrength password={password} />
          {errors.password && (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          )}
        </div>

        {/* Confirm password */}
        <div className="space-y-1.5">
          <label htmlFor="confirm_password" className="text-sm font-medium text-foreground">
            Confirm password
          </label>
          <div className="relative">
            <input
              id="confirm_password"
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              {...register('confirm_password')}
              placeholder="••••••••"
              className="w-full h-11 px-4 pr-11 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.confirm_password && (
            <p className="text-xs text-destructive">
              {errors.confirm_password.message}
            </p>
          )}
        </div>

        {/* Terms */}
        <div className="flex items-start gap-2">
          <input
            id="terms"
            type="checkbox"
            {...register('terms')}
            className="w-4 h-4 mt-0.5 rounded border-border text-primary focus:ring-primary/50"
          />
          <label htmlFor="terms" className="text-sm text-muted-foreground cursor-pointer">
            I agree to the{' '}
            <Link href="/terms" className="text-primary hover:underline">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>
          </label>
        </div>
        {errors.terms && (
          <p className="text-xs text-destructive -mt-2">{errors.terms.message}</p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isPending}
          className="w-full h-11 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Creating account...
            </>
          ) : (
            'Create free account'
          )}
        </button>
      </form>

      <p className="text-center text-sm text-muted-foreground mt-5">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
