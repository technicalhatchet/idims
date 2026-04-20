import React from 'react';
import Head from 'next/head';
import Layout from '../../components/layout/Layout';
import ServiceList from '../../components/services/ServiceList';
import { withAuthServerSideProps } from '../../utils/auth';

const ServicesPage = () => {
  return (
    <Layout>
      <Head>
        <title>Services | IDIMS</title>
      </Head>
      <div className="container mx-auto px-4 py-6">
        <ServiceList />
      </div>
    </Layout>
  );
};

export const getServerSideProps = withAuthServerSideProps({ requireAdmin: false });

export default ServicesPage; 