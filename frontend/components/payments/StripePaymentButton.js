import React, { useState } from 'react';
import { apiClient } from '../../utils/api-client';

const StripePaymentButton = ({ 
  workOrder, 
  onPaymentSuccess, 
  onPaymentError,
  className = ""
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  const handlePayment = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      // Get client information
      const clientEmail = workOrder.client?.email || workOrder.client_user?.email;
      const clientName = workOrder.client_name || `${workOrder.client?.first_name || ''} ${workOrder.client?.last_name || ''}`.trim();

      if (!clientEmail) {
        throw new Error('Client email is required for payment processing');
      }

      // Create checkout session
      const response = await apiClient('stripe/create-checkout-session', {
        method: 'POST',
        body: JSON.stringify({
          work_order_id: workOrder.id,
          client_email: clientEmail,
          client_name: clientName,
          success_url: `${window.location.origin}/work-orders/${workOrder.id}?payment=success`,
          cancel_url: `${window.location.origin}/work-orders/${workOrder.id}?payment=cancelled`,
          metadata: {
            work_order_number: workOrder.order_number || workOrder.id.slice(0, 8)
          }
        })
      });

      if (response.url) {
        // Redirect to Stripe Checkout
        window.location.href = response.url;
      } else {
        throw new Error('Failed to create payment session');
      }

    } catch (error) {
      console.error('Payment error:', error);
      setError(error.message || 'Failed to process payment');
      if (onPaymentError) {
        onPaymentError(error);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Calculate the amount due today
  const calculateDueToday = () => {
    const billableServicesTotal = (workOrder.services || [])
      .filter(service => service.billing_status === 'billable')
      .reduce((sum, service) => sum + (service.price || 0), 0);
    
    const billablePartsTotal = (workOrder.parts || [])
      .filter(part => ['completed', 'phone_payment', 'up_front'].includes(part.status))
      .reduce((sum, part) => sum + (part.price || 0), 0);
    
    const billableTotal = billableServicesTotal + billablePartsTotal;
    const previouslyPaid = workOrder.amount_previously_paid || 0;
    const dueToday = billableTotal - previouslyPaid;
    
    return Math.max(0, dueToday);
  };

  const dueToday = calculateDueToday();

  // Don't show button if no amount is due
  if (dueToday <= 0) {
    return (
      <div className="text-sm text-gray-600 dark:text-gray-400">
        No payment required
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && (
        <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}
      
      <button
        onClick={handlePayment}
        disabled={isProcessing}
        className={`
          w-full px-4 py-2 bg-green-600 text-white rounded-md 
          hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed
          transition-colors duration-200 font-medium
          ${className}
        `}
      >
        {isProcessing ? (
          <div className="flex items-center justify-center space-x-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span>Processing...</span>
          </div>
        ) : (
          <div className="flex items-center justify-center space-x-2">
            <span>💳</span>
            <span>Pay ${dueToday.toFixed(2)}</span>
          </div>
        )}
      </button>
      
      <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
        Secure payment powered by Stripe
      </div>
    </div>
  );
};

export default StripePaymentButton;

