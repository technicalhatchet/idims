import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaUser, FaPhone, FaMapMarkerAlt, FaCheckCircle, FaArrowRight, FaArrowLeft,
} from 'react-icons/fa';
import HomeLayout from '../components/layouts/HomeLayout';
import NeonIcon from '../components/ui/NeonIcon';
import SecretServiceMode from '../components/ui/SecretServiceMode';

/** Cyan vs orange — same mapping as neon PNGs / ApplianceIcon */
const APPLIANCES = [
  { id: 'refrigerator', name: 'Refrigerator', icon: 'refrigerator', color: 'cyan' },
  { id: 'washer', name: 'Washer', icon: 'washer', color: 'cyan' },
  { id: 'dryer', name: 'Dryer', icon: 'dryer', color: 'orange' },
  { id: 'aiolaundry', name: 'AIO Laundry', icon: 'aiolaundry', color: 'cyan' },
  { id: 'oven', name: 'Oven', icon: 'oven', color: 'orange' },
  { id: 'dishwasher', name: 'Dishwasher', icon: 'dishwasher', color: 'cyan' },
  { id: 'microwave', name: 'Microwave', icon: 'microwave', color: 'orange' },
  { id: 'freezer', name: 'Freezer', icon: 'freezer', color: 'cyan' },
  { id: 'tv', name: 'TV', icon: 'tv', color: 'orange' },
  { id: 'other', name: 'Other', icon: 'wrench', color: 'cyan', allowCustom: true },
];

const ISSUES = [
  { id: 'not-working', name: 'Not working at all', icon: 'powerOff' },
  { id: 'not-cooling-heating', name: 'Not cooling/heating', icon: 'thermometer' },
  { id: 'leaking', name: 'Leaking water', icon: 'droplet' },
  { id: 'making-noise', name: 'Making strange noise', icon: 'volume' },
  { id: 'error-code', name: 'Showing error code', icon: 'zap' },
  { id: 'other', name: 'Other issue', icon: 'zap', allowCustom: true },
];

const TIME_OPTIONS = [
  { id: 'today', name: 'Today', icon: 'calendarDot', desc: 'ASAP' },
  { id: 'tomorrow', name: 'Tomorrow', icon: 'calendar', desc: 'Next day' },
  { id: 'this-week', name: 'This Week', icon: 'calendarWeek', desc: 'Flexible' },
  { id: 'flexible', name: 'Flexible', icon: 'hourglass', desc: 'Any time' },
];

const STEPS = [
  { number: 1, title: 'Select Appliance' },
  { number: 2, title: "What's the issue?" },
  { number: 3, title: 'Choose a time' },
  { number: 4, title: 'Your Information' },
  { number: 5, title: 'Confirm Booking' },
];

export default function BookService() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [formData, setFormData] = useState({
    appliance: '',
    customAppliance: '',
    issue: '',
    customIssue: '',
    time: '',
    name: '',
    phone: '',
    address: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [pricingEstimate, setPricingEstimate] = useState(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingError, setPricingError] = useState(null);

  const fetchPricingEstimate = useCallback(async (signal) => {
    const response = await fetch('/api/public/booking-estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        appliance: formData.appliance,
        address: formData.address.trim(),
        custom_appliance: formData.appliance === 'other' ? formData.customAppliance : undefined,
      }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const detail = errBody.detail;
      const message = Array.isArray(detail)
        ? detail.map((d) => d.msg || d).join(', ')
        : detail || errBody.message || 'Could not load pricing';
      throw new Error(message);
    }

    return response.json();
  }, [formData.appliance, formData.address, formData.customAppliance]);

  const isOutOfServiceArea = pricingEstimate?.serviceable === false;
  const canConfirmBooking = Boolean(
    pricingEstimate?.serviceable === true && !pricingLoading && !pricingError
  );

  useEffect(() => {
    if (router.isReady) {
      const { appliance } = router.query;
      if (appliance) {
        const validAppliance = APPLIANCES.find(a => a.id === appliance);
        if (validAppliance) {
          setFormData(prev => ({ ...prev, appliance }));
        }
      }
    }
  }, [router.isReady, router.query]);

  // Upfront pricing on confirmation step
  useEffect(() => {
    if (currentStep !== 5 || isComplete || !formData.address?.trim() || !formData.appliance) {
      return undefined;
    }

    const controller = new AbortController();

    const loadEstimate = async () => {
      setPricingLoading(true);
      setPricingError(null);
      try {
        const data = await fetchPricingEstimate(controller.signal);
        setPricingEstimate(data);
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('Pricing estimate error:', err);
        setPricingError(err.message || 'Could not load pricing');
        setPricingEstimate(null);
      } finally {
        if (!controller.signal.aborted) {
          setPricingLoading(false);
        }
      }
    };

    loadEstimate();
    return () => controller.abort();
  }, [currentStep, isComplete, formData.appliance, formData.address, formData.customAppliance, fetchPricingEstimate]);

  // Early service-area check while entering address (step 4)
  useEffect(() => {
    if (currentStep !== 4 || !formData.address?.trim() || !formData.appliance) {
      return undefined;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setPricingLoading(true);
      setPricingError(null);
      try {
        const data = await fetchPricingEstimate(controller.signal);
        setPricingEstimate(data);
      } catch (err) {
        if (err.name === 'AbortError') return;
        setPricingError(err.message || 'Could not verify service area');
        setPricingEstimate(null);
      } finally {
        if (!controller.signal.aborted) {
          setPricingLoading(false);
        }
      }
    }, 800);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [currentStep, formData.address, formData.appliance, formData.customAppliance, fetchPricingEstimate]);

  const updateFormData = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (field === 'address') {
      setPricingEstimate(null);
      setPricingError(null);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1: 
        if (formData.appliance === 'other') {
          return formData.customAppliance.trim() !== '';
        }
        return formData.appliance !== '';
      case 2: 
        if (formData.issue === 'other') {
          return formData.customIssue.trim() !== '';
        }
        return formData.issue !== '';
      case 3: return formData.time !== '';
      case 4: {
        if (!formData.name || !formData.phone || !formData.address) return false;
        if (pricingLoading) return false;
        if (isOutOfServiceArea) return false;
        return true;
      }
      case 5: return true;
      default: return false;
    }
  };

  const nextStep = async () => {
    if (currentStep >= 5 || !canProceed()) return;

    if (currentStep === 4) {
      setPricingLoading(true);
      setPricingError(null);
      try {
        const data = await fetchPricingEstimate();
        setPricingEstimate(data);
        if (!data.serviceable) return;
      } catch (err) {
        setPricingError(err.message || 'Could not verify service area');
        return;
      } finally {
        setPricingLoading(false);
      }
    }

    setDirection(1);
    setCurrentStep((prev) => prev + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setDirection(-1);
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!canConfirmBooking) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/public/booking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone,
          email: '',
          address: formData.address,
          appliance: formData.appliance === 'other' ? formData.customAppliance : formData.appliance,
          issue: formData.issue === 'other' ? formData.customIssue : formData.issue,
          time_preference: formData.time,
        })
      });
  
      if (response.ok) {
        setIsComplete(true);
      } else {
        const errBody = await response.json().catch(() => ({}));
        const detail = errBody.detail;
        const message = Array.isArray(detail)
          ? detail.map((d) => d.msg || d).join(', ')
          : detail || errBody.message || 'Booking failed';
        throw new Error(message);
      }
    } catch (error) {
      console.error('Booking error:', error);
      alert(error.message || 'Booking failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const slideVariants = {
    enter: {
      opacity: 0,
      y: 10,
    },
    center: {
      opacity: 1,
      y: 0,
    },
    exit: {
      opacity: 0,
      y: -10,
    },
  };

  const getSelectedAppliance = () => {
    if (formData.appliance === 'other' && formData.customAppliance) {
      return { name: formData.customAppliance };
    }
    return APPLIANCES.find(a => a.id === formData.appliance);
  };
  const getSelectedIssue = () => {
    if (formData.issue === 'other' && formData.customIssue) {
      return { name: formData.customIssue };
    }
    return ISSUES.find(i => i.id === formData.issue);
  };
  const getSelectedTime = () => TIME_OPTIONS.find(t => t.id === formData.time);

  const formatCurrency = (amount) => {
    if (amount == null || Number.isNaN(Number(amount))) return null;
    return `$${Number(amount).toFixed(2)}`;
  };

  const formatTripCharge = (tripCharge) => {
    if (!tripCharge) return '—';
    if (tripCharge.is_custom && tripCharge.amount == null) {
      return 'Outside service area';
    }
    const formatted = formatCurrency(tripCharge.amount);
    return formatted != null ? formatted : '—';
  };

  return (
    <>
      <Head>
        <title>Book Service TEST | Atomic Repair</title>
        <meta name="description" content="Book your appliance repair service in under 60 seconds." />
        <link rel="manifest" href="/manifest-book.json" />
      </Head>

      {/* Background - Atomic Theme */}
      <div 
        className="fixed inset-0 z-0 overflow-hidden pointer-events-none"
        style={{ backgroundColor: '#000208' }}
      >
        <div 
          className="absolute blur-[120px] md:blur-[180px] w-[300px] h-[300px] md:w-[700px] md:h-[700px] -top-[50px] -left-[100px] md:-top-[100px] md:-left-[200px]"
          style={{ backgroundColor: 'rgba(0, 229, 255, 0.15)' }}
        />
        <div 
          className="absolute blur-[100px] md:blur-[150px] w-[250px] h-[250px] md:w-[500px] md:h-[500px] bottom-[15%] -right-[50px] md:bottom-[20%] md:-right-[100px]"
          style={{ backgroundColor: 'rgba(255, 122, 26, 0.18)' }}
        />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 0%, #000208 70%)' }} />
      </div>

      <div className="min-h-screen pt-28 pb-32 px-4 sm:px-6 relative z-10">
        <div className="max-w-3xl mx-auto">
          {/* Logo & Title */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-start gap-4 mb-6"
          >
            {/* Tap logo 5 times to reveal Service Mode */}
            <SecretServiceMode>
              <Image
                src="/wrenches.png"
                alt="Atomic Repair"
                width={70}
                height={70}
                className="drop-shadow-[0_0_25px_rgba(249,115,22,0.6)] flex-shrink-0"
              />
            </SecretServiceMode>
            <div className="text-left">
              <h1 className="text-2xl sm:text-3xl font-bold text-white">
                BOOK <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-300">YOUR SERVICE</span>
              </h1>
              <p className="text-gray-400 text-sm mt-1">Takes less than 60 seconds</p>
            </div>
          </motion.div>
        

          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between relative">
              {/* Progress Line Background */}
              <div className="absolute top-4 left-0 right-0 h-0.5 bg-white/10" />
              {/* Progress Line Fill */}
              <motion.div
                className="absolute top-4 left-0 h-0.5 bg-gradient-to-r from-cyan-500 to-cyan-400"
                initial={{ width: '0%' }}
                animate={{ width: `${((currentStep - 1) / 4) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
              
              {/* Step Indicators */}
              {STEPS.map((step) => (
                <div key={step.number} className="relative z-10 flex flex-col items-center">
                  <motion.div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                      currentStep >= step.number
                        ? 'bg-gradient-to-br from-cyan-500 to-cyan-600 text-white shadow-[0_0_20px_rgba(34,211,238,0.5)]'
                        : 'bg-[#1a1f2e] text-gray-500 border border-white/10'
                    }`}
                    animate={{
                      scale: currentStep === step.number ? 1.1 : 1,
                    }}
                  >
                    {currentStep > step.number ? (
                      <FaCheckCircle className="w-4 h-4" />
                    ) : (
                      step.number
                    )}
                  </motion.div>
                </div>
              ))}
            </div>
          </div>

          {/* Main Card */}
          <motion.div
            className="relative rounded-2xl overflow-visible"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {/* Card Glow */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500/30 via-transparent to-orange-500/30 rounded-2xl blur-sm" />
            
            {/* Card Content */}
            <div className="relative bg-[#0d1117]/90 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden flex flex-col">
			  <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={currentStep}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="p-6 sm:p-8"
                >
                  {/* Step Header */}
                  <div className="mb-6">
                    <h2 className="text-xl sm:text-2xl font-bold text-white">
                      {currentStep === 1 && 'What appliance can we help you with?'}
                      {currentStep === 2 && 'What issue are you experiencing?'}
                      {currentStep === 3 && 'When would you prefer us to come by?'}
                      {currentStep === 4 && 'Your Information'}
                      {currentStep === 5 && (isComplete ? 'You\'re all set!' : 'Review your booking')}
                    </h2>
                  </div>

                  {/* Step 1: Appliance Selection */}
                  {currentStep === 1 && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {APPLIANCES.map((appliance) => (
                          <motion.button
                            key={appliance.id}
                            onClick={() => updateFormData('appliance', appliance.id)}
                            className={`relative p-4 rounded-xl border transition-all duration-200 flex flex-col items-center gap-3 ${
                              formData.appliance === appliance.id
                                ? 'bg-cyan-500/10 border-cyan-500/50 shadow-[0_0_20px_rgba(34,211,238,0.2)]'
                                : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                            }`}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <NeonIcon
                              name={appliance.icon}
                              className="w-10 h-10 sm:w-12 sm:h-12"
                              variant={appliance.color || 'cyan'}
                            />
                            <span className="text-white font-medium text-xs sm:text-sm">{appliance.name}</span>
                            {formData.appliance === appliance.id && (
                              <motion.div
                                className="absolute top-2 right-2"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                              >
                                <FaCheckCircle className="w-4 h-4 text-cyan-400" />
                              </motion.div>
                            )}
                          </motion.button>
                        ))}
                      </div>
                      
                      {/* Custom appliance input when "Other" is selected */}
                      <AnimatePresence>
                        {formData.appliance === 'other' && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="pt-2">
                              <label className="block text-sm text-gray-400 mb-2">What appliance do you need help with?</label>
                              <input
                                type="text"
                                value={formData.customAppliance}
                                onChange={(e) => updateFormData('customAppliance', e.target.value)}
                                placeholder="e.g., Wine cooler, Ice maker, Garbage disposal..."
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
                                autoFocus
                              />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Step 2: Issue Selection */}
                  {currentStep === 2 && (
                    <div className="space-y-3">
                      {ISSUES.map((issue) => (
                          <motion.button
                            key={issue.id}
                            onClick={() => updateFormData('issue', issue.id)}
                            className={`w-full p-4 rounded-xl border transition-all duration-200 flex items-center gap-4 ${
                              formData.issue === issue.id
                                ? 'bg-cyan-500/10 border-cyan-500/50 shadow-[0_0_20px_rgba(34,211,238,0.2)]'
                                : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                            }`}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                          >
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              formData.issue === issue.id ? 'bg-cyan-500/20' : 'bg-white/5'
                            }`}>
                              <NeonIcon
                                name={issue.icon}
                                className="w-5 h-5"
                                variant="cyan"
                              />
                            </div>
                            <span className="text-white font-medium">{issue.name}</span>
                            {formData.issue === issue.id && (
                              <FaCheckCircle className="w-5 h-5 text-cyan-400 ml-auto" />
                            )}
                          </motion.button>
                      ))}
                      
                      {/* Custom issue input when "Other" is selected */}
                      <AnimatePresence>
                        {formData.issue === 'other' && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="pt-2">
                              <label className="block text-sm text-gray-400 mb-2">Please describe the issue</label>
                              <textarea
                                value={formData.customIssue}
                                onChange={(e) => updateFormData('customIssue', e.target.value)}
                                placeholder="Describe what's happening with your appliance..."
                                rows={3}
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all resize-none"
                                autoFocus
                              />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Step 3: Time Selection */}
                  {currentStep === 3 && (
                    <div className="grid grid-cols-2 gap-4">
                      {TIME_OPTIONS.map((option) => (
                          <motion.button
                            key={option.id}
                            onClick={() => updateFormData('time', option.id)}
                            className={`p-5 rounded-xl border transition-all duration-200 flex flex-col items-center gap-2 ${
                              formData.time === option.id
                                ? 'bg-cyan-500/10 border-cyan-500/50 shadow-[0_0_20px_rgba(34,211,238,0.2)]'
                                : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                            }`}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <NeonIcon
                              name={option.icon}
                              className="w-8 h-8"
                              variant="cyan"
                            />
                            <span className="text-white font-medium">{option.name}</span>
                            {formData.time === option.id && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                              >
                                <FaCheckCircle className="w-5 h-5 text-cyan-400" />
                              </motion.div>
                            )}
                          </motion.button>
                      ))}
                    </div>
                  )}

                  {/* Step 4: Customer Info */}
                  {currentStep === 4 && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Full Name</label>
                        <div className="relative">
                          <FaUser className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                          <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => updateFormData('name', e.target.value)}
                            placeholder="John Smith"
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-gray-500 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Phone Number</label>
                        <div className="relative">
                          <FaPhone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                          <input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => updateFormData('phone', e.target.value)}
                            placeholder="(419) 555-1234"
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-gray-500 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Address</label>
                        <div className="relative">
                          <FaMapMarkerAlt className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                          <input
                            type="text"
                            value={formData.address}
                            onChange={(e) => updateFormData('address', e.target.value)}
                            placeholder="123 Main St, Toledo, OH 43604"
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-gray-500 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
                          />
                        </div>
                        {pricingLoading && formData.address.trim() && (
                          <p className="mt-2 text-xs text-gray-500">Checking service area…</p>
                        )}
                        {isOutOfServiceArea && (
                          <div className="mt-3 rounded-xl border border-orange-500/40 bg-orange-500/10 p-3 text-sm text-orange-200/90">
                            <p className="font-medium text-orange-300 mb-1">Outside our service area</p>
                            <p className="text-xs leading-relaxed text-orange-200/80">
                              {pricingEstimate?.service_area_message || (
                                'Online booking is only available in our northwest Ohio service area. '
                                + 'Call (419) 515-3394 if you need help.'
                              )}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Step 5: Confirmation */}
                  {currentStep === 5 && (
                    <div className="flex flex-col sm:flex-row gap-6">
                      {/* Left - Status */}
                      <div className="flex-1">
                        {isComplete ? (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex flex-col items-center text-center py-6"
                          >
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: 'spring', delay: 0.2 }}
                              className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(34,211,238,0.5)]"
                            >
                              <FaCheckCircle className="w-10 h-10 text-white" />
                            </motion.div>
                            <h3 className="text-xl font-bold text-white mb-2">You're all set!</h3>
                            <p className="text-gray-400 text-sm">
                              We've received your booking and will contact you shortly to confirm.
                            </p>
                          </motion.div>
                        ) : isOutOfServiceArea ? (
                          <div className="space-y-4">
                            <div className="rounded-xl border border-orange-500/40 bg-orange-500/10 p-4">
                              <p className="font-semibold text-orange-300 mb-2">We can&apos;t book this address online</p>
                              <p className="text-sm text-orange-200/80 leading-relaxed">
                                {pricingEstimate?.service_area_message || (
                                  'This location is outside our standard service area. '
                                  + 'Please double-check your address or call (419) 515-3394.'
                                )}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={prevStep}
                              className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                            >
                              ← Go back and update your address
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="flex items-center gap-3 text-cyan-400">
                              <FaCheckCircle className="w-5 h-5" />
                              <span className="font-medium">Ready to confirm</span>
                            </div>
                            <p className="text-gray-400 text-sm">
                              Please review your booking details and confirm your appointment.
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Right - Summary */}
                      <div className="flex-1 bg-white/5 rounded-xl p-5 border border-white/10">
                        <h4 className="text-sm font-semibold text-gray-400 mb-4">Booking Summary</h4>
                        <div className="space-y-3">
                          <div className="flex justify-between text-sm gap-2">
                            <span className="text-gray-500 flex-shrink-0">Appliance</span>
                            <span className="text-white font-medium text-right">{getSelectedAppliance()?.name || '-'}</span>
                          </div>
                          <div className="flex justify-between text-sm gap-2">
                            <span className="text-gray-500 flex-shrink-0">Issue</span>
                            <span className="text-white font-medium text-right line-clamp-2">{getSelectedIssue()?.name || '-'}</span>
                          </div>
                          <div className="flex justify-between text-sm gap-2">
                            <span className="text-gray-500 flex-shrink-0">Time</span>
                            <span className="text-white font-medium">{getSelectedTime()?.name || '-'}</span>
                          </div>
                          <div className="border-t border-white/10 my-3" />
                          <div className="flex justify-between text-sm gap-2">
                            <span className="text-gray-500 flex-shrink-0">Contact</span>
                            <span className="text-white font-medium">{formData.phone || '-'}</span>
                          </div>
                          <div className="flex justify-between text-sm gap-2">
                            <span className="text-gray-500 flex-shrink-0">Address</span>
                            <span className="text-white font-medium text-right line-clamp-2">{formData.address || '-'}</span>
                          </div>

                          <div className="border-t border-white/10 my-3" />
                          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-400/80">
                            Upfront pricing
                          </p>

                          {pricingLoading && (
                            <div className="flex items-center gap-2 text-sm text-gray-400 py-1">
                              <div className="w-4 h-4 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
                              Calculating estimate…
                            </div>
                          )}

                          {pricingError && !pricingLoading && (
                            <p className="text-sm text-amber-400/90">
                              {pricingError}
                            </p>
                          )}

                          {isOutOfServiceArea && !pricingLoading && (
                            <p className="text-sm text-orange-300/90">
                              Online booking is not available for this address.
                            </p>
                          )}

                          {pricingEstimate && !pricingLoading && !isOutOfServiceArea && (
                            <>
                              <div className="flex justify-between text-sm gap-2">
                                <span className="text-gray-500 flex-shrink-0">Diagnostic</span>
                                <span className="text-white font-medium text-right">
                                  {pricingEstimate.diagnostic
                                    ? `${formatCurrency(pricingEstimate.diagnostic.price)} · ${pricingEstimate.diagnostic.name}`
                                    : 'Contact for quote'}
                                </span>
                              </div>
                              <div className="flex justify-between text-sm gap-2">
                                <span className="text-gray-500 flex-shrink-0">Trip charge</span>
                                <span className="text-white font-medium text-right">
                                  {formatTripCharge(pricingEstimate.trip_charge)}
                                  {pricingEstimate.trip_charge?.zone_name && (
                                    <span className="block text-xs text-gray-500 font-normal">
                                      {pricingEstimate.trip_charge.zone_name} area
                                    </span>
                                  )}
                                </span>
                              </div>
                              {pricingEstimate.estimated_total != null && (
                                <div className="flex justify-between text-sm gap-2 pt-1">
                                  <span className="text-gray-400 font-medium">Est. due at visit</span>
                                  <span className="text-cyan-300 font-semibold">
                                    {formatCurrency(pricingEstimate.estimated_total)}
                                  </span>
                                </div>
                              )}
                              {pricingEstimate.note && (
                                <p className="text-xs text-gray-500 leading-relaxed pt-1">
                                  {pricingEstimate.note}
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Navigation Buttons - hidden on mobile, using sticky footer instead */}
              <div className="hidden sm:flex items-center gap-4 mt-8 pt-6 border-t border-white/5">
                {currentStep > 1 && !isComplete && (
                  <motion.button
                    onClick={prevStep}
                    className="flex-1 sm:flex-none px-6 py-3 rounded-xl border border-white/10 text-white font-medium hover:bg-white/5 transition-all flex items-center justify-center gap-2"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <FaArrowLeft className="w-4 h-4" />
                    Back
                  </motion.button>
                )}
                
                {currentStep < 5 ? (
                  <motion.button
                    onClick={nextStep}
                    disabled={!canProceed()}
                    className={`flex-1 py-3 px-6 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
                      canProceed()
                        ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white shadow-[0_0_25px_rgba(34,211,238,0.4)] hover:shadow-[0_0_35px_rgba(34,211,238,0.6)]'
                        : 'bg-white/10 text-gray-500 cursor-not-allowed'
                    }`}
                    whileHover={canProceed() ? { scale: 1.02 } : {}}
                    whileTap={canProceed() ? { scale: 0.98 } : {}}
                  >
                    Next
                    <FaArrowRight className="w-4 h-4" />
                  </motion.button>
                ) : !isComplete ? (
                  <motion.button
                    onClick={handleSubmit}
                    disabled={isSubmitting || !canConfirmBooking}
                    className={`flex-1 py-3 px-6 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
                      canConfirmBooking && !isSubmitting
                        ? 'text-white shadow-[0_0_25px_rgba(251,146,60,0.4)] hover:shadow-[0_0_35px_rgba(251,146,60,0.6)]'
                        : 'bg-white/10 text-gray-500 cursor-not-allowed'
                    }`}
                    style={canConfirmBooking && !isSubmitting ? { background: 'linear-gradient(135deg, #fb923c 0%, #fbbf24 100%)' } : undefined}
                    whileHover={canConfirmBooking && !isSubmitting ? { scale: 1.02 } : {}}
                    whileTap={canConfirmBooking && !isSubmitting ? { scale: 0.98 } : {}}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Confirming...
                      </>
                    ) : pricingLoading ? (
                      'Checking service area…'
                    ) : isOutOfServiceArea ? (
                      'Outside service area'
                    ) : (
                      <>
                        Confirm Appointment
                        <FaCheckCircle className="w-4 h-4" />
                      </>
                    )}
                  </motion.button>
                ) : (
                  <Link href="/" className="flex-1">
                    <motion.button
                      className="w-full py-3 px-6 rounded-xl font-semibold bg-gradient-to-r from-cyan-500 to-cyan-600 text-white shadow-[0_0_25px_rgba(34,211,238,0.4)] flex items-center justify-center gap-2"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Back to Home
                      <FaArrowRight className="w-4 h-4" />
                    </motion.button>
                  </Link>
                )}
              </div>
            </div>
          </motion.div>

          {/* Trust Indicators */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-4"
          >
            {[
              { icon: 'zap', title: 'FAST & EASY', desc: 'Book in under 60 seconds' },
              { icon: 'shield', title: 'TRUSTED EXPERTS', desc: 'Certified technicians you can trust' },
              { icon: 'clock', title: 'ON TIME SERVICE', desc: 'We respect your time' },
              { icon: 'medal', title: 'SATISFACTION GUARANTEED', desc: 'We stand behind our work' },
            ].map((item, i) => (
                <div key={i} className="flex flex-col items-center text-center p-4">
                  <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center mb-2">
                    <NeonIcon name={item.icon} className="w-5 h-5" variant="cyan" />
                  </div>
                  <p className="text-white text-xs font-semibold">{item.title}</p>
                  <p className="text-gray-500 text-xs mt-1">{item.desc}</p>
                </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Mobile Sticky CTA */}
      <div 
        className="fixed bottom-0 left-0 right-0 px-4 pt-4 backdrop-blur-md border-t border-white/5 sm:hidden z-40" 
        style={{ 
          backgroundColor: 'rgba(0, 2, 8, 0.95)',
          paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))'
        }}
      >
        <div className="flex gap-3">
          {currentStep > 1 && !isComplete && (
            <button
              onClick={prevStep}
              className="px-4 py-3 rounded-xl border border-white/10 text-white font-medium"
            >
              <FaArrowLeft className="w-4 h-4" />
            </button>
          )}
          {currentStep < 5 ? (
            <button
              onClick={nextStep}
              disabled={!canProceed()}
              className={`flex-1 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 ${
                canProceed()
                  ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white'
                  : 'bg-white/10 text-gray-500'
              }`}
            >
              Next <FaArrowRight className="w-4 h-4" />
            </button>
          ) : !isComplete ? (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !canConfirmBooking}
              className={`flex-1 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 ${
                canConfirmBooking && !isSubmitting
                  ? 'text-white'
                  : 'bg-white/10 text-gray-500 cursor-not-allowed'
              }`}
              style={canConfirmBooking && !isSubmitting ? { background: 'linear-gradient(135deg, #fb923c 0%, #fbbf24 100%)' } : undefined}
            >
              {isSubmitting
                ? 'Confirming...'
                : pricingLoading
                  ? 'Checking…'
                  : isOutOfServiceArea
                    ? 'Outside area'
                    : 'Confirm'}
            </button>
          ) : (
            <Link href="/" className="flex-1">
              <button className="w-full py-3 rounded-xl font-semibold bg-gradient-to-r from-cyan-500 to-cyan-600 text-white">
                Back to Home
              </button>
            </Link>
          )}
        </div>
      </div>
    </>
  );
}

BookService.getLayout = function getLayout(page) {
  return <HomeLayout title="Book Service | Atomic Repair">{page}</HomeLayout>;
};
