'use client';

import React from 'react';
import Link from 'next/link';

export default function DJPage() {
    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(to bottom right, #000000, #0f172a, #000000)',
            color: '#06b6d4',
            padding: '2rem'
        }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '2rem',
                borderBottom: '1px solid #164e63',
                paddingBottom: '1rem'
            }}>
                <h1 style={{
                    fontSize: '2rem',
                    fontWeight: 'bold',
                    letterSpacing: '0.1em'
                }}>
                    🎛️ DJ MODE
                </h1>
                <Link
                    href="/"
                    style={{
                        padding: '0.5rem 1rem',
                        background: '#164e63',
                        borderRadius: '0.5rem',
                        color: '#06b6d4',
                        textDecoration: 'none',
                        fontSize: '0.875rem'
                    }}
                >
                    ← Back to Producer
                </Link>
            </div>

            {/* Content */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '2rem',
                marginTop: '2rem'
            }}>
                {/* Deck A */}
                <div style={{
                    background: 'rgba(6, 182, 212, 0.1)',
                    border: '2px solid #06b6d4',
                    borderRadius: '1rem',
                    padding: '2rem',
                    textAlign: 'center'
                }}>
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>DECK A</h2>
                    <div style={{
                        width: '200px',
                        height: '200px',
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, #06b6d4 0%, #0891b2 50%, #0e7490 100%)',
                        margin: '0 auto',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '3rem',
                        fontWeight: 'bold',
                        color: 'white',
                        boxShadow: '0 0 40px rgba(6, 182, 212, 0.5)'
                    }}>
                        A
                    </div>
                </div>

                {/* Deck B */}
                <div style={{
                    background: 'rgba(217, 70, 239, 0.1)',
                    border: '2px solid #d946ef',
                    borderRadius: '1rem',
                    padding: '2rem',
                    textAlign: 'center'
                }}>
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#d946ef' }}>DECK B</h2>
                    <div style={{
                        width: '200px',
                        height: '200px',
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, #d946ef 0%, #c026d3 50%, #a21caf 100%)',
                        margin: '0 auto',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '3rem',
                        fontWeight: 'bold',
                        color: 'white',
                        boxShadow: '0 0 40px rgba(217, 70, 239, 0.5)'
                    }}>
                        B
                    </div>
                </div>
            </div>

            {/* Mixer Section */}
            <div style={{
                marginTop: '2rem',
                background: 'rgba(0, 0, 0, 0.5)',
                border: '1px solid #334155',
                borderRadius: '1rem',
                padding: '2rem'
            }}>
                <h3 style={{ textAlign: 'center', marginBottom: '1rem' }}>CROSSFADER</h3>
                <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.01"
                    defaultValue="0"
                    style={{
                        width: '100%',
                        height: '60px',
                        cursor: 'pointer'
                    }}
                />
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: '0.5rem',
                    fontSize: '0.875rem'
                }}>
                    <span>DECK A</span>
                    <span style={{ color: '#d946ef' }}>DECK B</span>
                </div>
            </div>

            <div style={{
                marginTop: '2rem',
                textAlign: 'center',
                color: '#64748b',
                fontSize: '0.875rem'
            }}>
                DJ Mode - Full controls coming soon! This is a safe test build.
            </div>
        </div>
    );
}
