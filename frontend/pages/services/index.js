import React from 'react';
import Head from 'next/head';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import ServiceList from '../../components/services/ServiceList';
import { withAuthServerSideProps } from '../../utils/auth';

const ServicesPage = () => {
  return (
    <DashboardLayout>
      <Head>
        <title>Services | IDIMS</title>
      </Head>
      <div className="container mx-auto px-4 py-6">
        <ServiceList />
      </div>
    </DashboardLayout>
  );
};

export const getServerSideProps = withAuthServerSideProps({ requireAdmin: false });

export default ServicesPage;
