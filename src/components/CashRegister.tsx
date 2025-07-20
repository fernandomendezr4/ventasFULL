import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../hooks/useNotification';
import { DollarSign, Clock, TrendingUp, TrendingDown, Calculator, Save, X } from 'lucide-react';

interface CashRegister {
  id: string;
  user_id: string;
  opening_amount: number;
  closing_amount: number;
  total_sales: number;
  status: 'open' | 'closed';
  opened_at: string;
  closed_at: string | null;
  notes: string;
  expected_closing_amount: number;
  actual_closing_amount: number;
  discrepancy_amount: number;
  discrepancy_reason: string;
  session_notes: string;
  last_movement_at: string;
}

interface CashMovement {
  id: string;
  cash_register_id: string;
  type: 'income' | 'expense' | 'sale' | 'opening' | 'closing';
  category: string;
  amount: number;
  description: string;
  created_at: string;
}

export default function CashRegister() {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [currentRegister, setCurrentRegister] = useState<CashRegister | null>(null);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [openingAmount, setOpeningAmount] = useState('');
  const [closingAmount, setClosingAmount] = useState('');
  const [sessionNotes, setSessionNotes] = useState('');

  useEffect(() => {
    loadCurrentRegister();
  }, [user]);

  const loadCurrentRegister = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Get current open register for user
      const { data: register, error } = await supabase
        .from('cash_registers')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setCurrentRegister(register);

      if (register) {
        loadMovements(register.id);
      }
    } catch (error) {
      console.error('Error loading cash register:', error);
      showNotification('Error loading cash register', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadMovements = async (registerId: string) => {
    try {
      const { data, error } = await supabase
        .from('cash_movements')
        .select('*')
        .eq('cash_register_id', registerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMovements(data || []);
    } catch (error) {
      console.error('Error loading movements:', error);
    }
  };

  const openRegister = async () => {
    if (!user || !openingAmount) return;

    try {
      const { data, error } = await supabase
        .from('cash_registers')
        .insert({
          user_id: user.id,
          opening_amount: parseFloat(openingAmount),
          status: 'open',
          session_notes: sessionNotes
        })
        .select()
        .single();

      if (error) throw error;

      setCurrentRegister(data);
      setShowOpenModal(false);
      setOpeningAmount('');
      setSessionNotes('');
      showNotification('Cash register opened successfully', 'success');
      loadMovements(data.id);
    } catch (error) {
      console.error('Error opening register:', error);
      showNotification('Error opening cash register', 'error');
    }
  };

  const closeRegister = async () => {
    if (!currentRegister || !closingAmount) return;

    try {
      const actualAmount = parseFloat(closingAmount);
      const expectedAmount = currentRegister.opening_amount + currentRegister.total_sales;
      const discrepancy = actualAmount - expectedAmount;

      const { error } = await supabase
        .from('cash_registers')
        .update({
          status: 'closed',
          actual_closing_amount: actualAmount,
          expected_closing_amount: expectedAmount,
          discrepancy_amount: discrepancy,
          closed_at: new Date().toISOString(),
          session_notes: sessionNotes
        })
        .eq('id', currentRegister.id);

      if (error) throw error;

      setCurrentRegister(null);
      setMovements([]);
      setShowCloseModal(false);
      setClosingAmount('');
      setSessionNotes('');
      showNotification('Cash register closed successfully', 'success');
    } catch (error) {
      console.error('Error closing register:', error);
      showNotification('Error closing cash register', 'error');
    }
  };

  const calculateCurrentBalance = () => {
    if (!currentRegister) return 0;
    
    const income = movements
      .filter(m => m.type === 'income' || m.type === 'sale')
      .reduce((sum, m) => sum + m.amount, 0);
    
    const expenses = movements
      .filter(m => m.type === 'expense')
      .reduce((sum, m) => sum + m.amount, 0);

    return currentRegister.opening_amount + income - expenses;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Cash Register</h1>
        {!currentRegister ? (
          <button
            onClick={() => setShowOpenModal(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <DollarSign className="w-4 h-4" />
            Open Register
          </button>
        ) : (
          <button
            onClick={() => setShowCloseModal(true)}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Close Register
          </button>
        )}
      </div>

      {currentRegister ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Opening Amount</p>
                <p className="text-2xl font-bold">${currentRegister.opening_amount.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center gap-3">
              <Calculator className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Current Balance</p>
                <p className="text-2xl font-bold">${calculateCurrentBalance().toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-purple-600" />
              <div>
                <p className="text-sm text-gray-600">Opened At</p>
                <p className="text-lg font-semibold">
                  {new Date(currentRegister.opened_at).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 p-8 rounded-lg text-center">
          <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Active Cash Register</h3>
          <p className="text-gray-600 mb-4">Open a cash register to start processing transactions</p>
        </div>
      )}

      {/* Open Register Modal */}
      {showOpenModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Open Cash Register</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Opening Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={openingAmount}
                  onChange={(e) => setOpeningAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Session Notes (Optional)
                </label>
                <textarea
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Any notes for this session..."
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={openRegister}
                className="flex-1 bg-green-600 text-white py-2 rounded-md hover:bg-green-700 flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                Open Register
              </button>
              <button
                onClick={() => setShowOpenModal(false)}
                className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Register Modal */}
      {showCloseModal && currentRegister && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Close Cash Register</h3>
            <div className="space-y-4">
              <div className="bg-gray-50 p-3 rounded">
                <p className="text-sm text-gray-600">Expected Amount</p>
                <p className="text-lg font-semibold">
                  ${(currentRegister.opening_amount + currentRegister.total_sales).toFixed(2)}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Actual Closing Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={closingAmount}
                  onChange={(e) => setClosingAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Closing Notes (Optional)
                </label>
                <textarea
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Any closing notes..."
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={closeRegister}
                className="flex-1 bg-red-600 text-white py-2 rounded-md hover:bg-red-700 flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                Close Register
              </button>
              <button
                onClick={() => setShowCloseModal(false)}
                className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}